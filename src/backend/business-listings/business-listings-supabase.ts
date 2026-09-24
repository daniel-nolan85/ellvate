import type { SupabaseClient } from '@supabase/supabase-js';

import {
  extractExistingLogo,
  extractExistingMedia,
  extractLogoUpload,
  extractMediaUploads,
} from '@/src/backend/media';
import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';
import { removeStorageObjects, uploadDataUrl } from '@/src/services/storage';

import { defaultDisplayName, type BusinessCategory } from '@/src/backend/store';

import { uploadReportEvidence, type ValidReportSubmission } from '@/src/backend/reports';

import type {
  BusinessesPage,
  BusinessesView,
  BusinessListing,
  BusinessMedia,
  CreatedBusinessListingResult,
  MyBusinessListingsPage,
  ReportBusinessListingResult,
  UpdateBusinessListingResult,
  VerificationMethod,
  VerificationStatus,
} from './types';
import { validateBusinessListingInput } from './validation';
import { resolveVerification } from './verification';

const BUSINESS_SELECT =
  'id,created_by,business_name,category,description,contact_phone,contact_email,contact_website,address,hours,current_special,special_updated_at,logo,media,verification_status,verification_method,verified_at,created_at,edited_at';

interface BusinessRow {
  readonly id: string;
  readonly created_by: string;
  readonly business_name: string;
  readonly category: string;
  readonly description: string;
  readonly contact_phone: string | null;
  readonly contact_email: string | null;
  readonly contact_website: string | null;
  readonly address: string | null;
  readonly hours: string | null;
  readonly current_special: string | null;
  readonly special_updated_at: string | null;
  readonly logo: BusinessMedia | null;
  readonly media: readonly BusinessMedia[] | null;
  readonly verification_status: string;
  readonly verification_method: string | null;
  readonly verified_at: string | null;
  readonly created_at: string;
  readonly edited_at: string | null;
}

interface PersonLookup {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

type UploadBusinessMediaResult =
  | { readonly ok: true; readonly media: readonly BusinessMedia[] }
  | { readonly ok: false; readonly uploaded: readonly BusinessMedia[] };

const toBusinessListingView = (
  row: BusinessRow,
  nameById: ReadonlyMap<string, PersonLookup>,
): BusinessListing => {
  const author = nameById.get(row.created_by);
  return {
    id: row.id,
    author: {
      avatarUrl: author?.avatarUrl ?? null,
      id: row.created_by,
      isAdmin: author?.isAdmin ?? false,
      name: author?.name ?? 'Member',
    },
    businessName: row.business_name,
    category: row.category as BusinessCategory,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    contactWebsite: row.contact_website,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    description: row.description,
    hours: row.hours,
    address: row.address,
    currentSpecial: row.current_special,
    specialUpdatedAt: row.special_updated_at,
    logo: row.logo ?? undefined,
    media: row.media ?? undefined,
    verificationStatus: row.verification_status as VerificationStatus,
    verificationMethod: (row.verification_method as VerificationMethod | null) ?? null,
    verifiedAt: row.verified_at,
  };
};

const nameMapFor = async (
  supabase: SupabaseClient,
  userIds: readonly string[],
): Promise<ReadonlyMap<string, PersonLookup>> => {
  if (userIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from('app_users')
    .select('id,name,avatar_url,is_admin')
    .in('id', userIds);
  throwIfSupabaseError(error, 'load business listing authors');
  return new Map(
    (data ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        isAdmin: Boolean(row.is_admin),
        name: row.name as string,
      },
    ]),
  );
};

const MEDIA_UPLOAD_FAILED_MESSAGE =
  'One or more images failed to upload. Please try again.';

const uploadBusinessMedia = async (
  supabase: SupabaseClient,
  listingId: string,
  input: unknown,
): Promise<UploadBusinessMediaResult> => {
  const uploads = extractMediaUploads(input);
  if (uploads.length === 0) {
    return { media: [], ok: true };
  }
  const results = await Promise.all(
    uploads.map(async (upload) => {
      const url = await uploadDataUrl(
        supabase,
        upload.dataUrl,
        upload.filename,
        'business-listings',
        listingId,
      );
      return url ? { filename: upload.filename, url } : null;
    }),
  );
  const succeeded = results.filter(
    (media): media is BusinessMedia => media !== null,
  );
  if (succeeded.length !== results.length) {
    return { ok: false, uploaded: succeeded };
  }
  return { media: succeeded, ok: true };
};

type UploadBusinessLogoResult =
  | { readonly ok: true; readonly logo: BusinessMedia | null }
  | { readonly ok: false };

const uploadBusinessLogo = async (
  supabase: SupabaseClient,
  listingId: string,
  input: unknown,
): Promise<UploadBusinessLogoResult> => {
  const upload = extractLogoUpload(input);
  if (!upload) {
    return { logo: null, ok: true };
  }
  const url = await uploadDataUrl(
    supabase,
    upload.dataUrl,
    upload.filename,
    'business-listings',
    listingId,
  );
  return url ? { logo: { filename: upload.filename, url }, ok: true } : { ok: false };
};

// A real Clerk user has no app_users row yet; create it before any owned
// write so foreign keys resolve. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = defaultDisplayName(userId),
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure business listing user');
};

export async function getBusinessesViewSupabase(
  supabase: SupabaseClient,
  category: BusinessCategory | undefined,
): Promise<BusinessesView> {
  // No verification filter here: RLS on business_listings already restricts
  // select to `verification_status = 'verified' OR created_by = self`.
  const query = supabase
    .from('business_listings')
    .select(BUSINESS_SELECT)
    .order('created_at', { ascending: false });
  const { data, error } = await (category ? query.eq('category', category) : query);
  throwIfSupabaseError(error, 'load business listings');
  const rows = (data ?? []) as unknown as BusinessRow[];
  const nameById = await nameMapFor(supabase, [...new Set(rows.map((row) => row.created_by))]);
  return { listings: rows.map((row) => toBusinessListingView(row, nameById)) };
}

export async function listBusinessesPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  category: BusinessCategory | undefined,
  limit: number,
  cursor: string | null,
): Promise<BusinessesPage> {
  const query = supabase
    .from('business_listings')
    .select(BUSINESS_SELECT)
    .order('created_at', { ascending: false });
  const [{ data, error }, mutedUserIds] = await Promise.all([
    category ? query.eq('category', category) : query,
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load business listings');
  const mutedSet = new Set(mutedUserIds);
  const rows = ((data ?? []) as unknown as BusinessRow[]).filter(
    (row) => !mutedSet.has(row.created_by),
  );
  const wrapped = rows.map((row) => ({ id: row.id, row, sortKey: row.created_at }));
  const page = paginateInMemory(wrapped, limit, cursor);
  const nameById = await nameMapFor(
    supabase,
    [...new Set(page.items.map((item) => item.row.created_by))],
  );
  return {
    listings: page.items.map((item) => toBusinessListingView(item.row, nameById)),
    nextCursor: page.nextCursor,
  };
}

export async function getBusinessesByIdsSupabase(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<readonly BusinessListing[]> {
  const { data, error } = await supabase
    .from('business_listings')
    .select(BUSINESS_SELECT)
    .in('id', ids);
  throwIfSupabaseError(error, 'load business listings by id');
  const rows = (data ?? []) as unknown as BusinessRow[];
  const nameById = await nameMapFor(supabase, [...new Set(rows.map((row) => row.created_by))]);
  return rows.map((row) => toBusinessListingView(row, nameById));
}

export async function getMyBusinessListingsViewSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
): Promise<MyBusinessListingsPage> {
  const { data, error } = await supabase
    .from('business_listings')
    .select(BUSINESS_SELECT)
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  throwIfSupabaseError(error, 'load my business listings');
  const rows = (data ?? []) as unknown as BusinessRow[];
  const wrapped = rows.map((row) => ({ id: row.id, row, sortKey: row.created_at }));
  const page = paginateInMemory(wrapped, limit, cursor);
  const nameById = await nameMapFor(supabase, [userId]);
  return {
    listings: page.items.map((item) => toBusinessListingView(item.row, nameById)),
    nextCursor: page.nextCursor,
  };
}

export async function createBusinessListingSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<CreatedBusinessListingResult> {
  const validation = validateBusinessListingInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  await ensureUser(supabase, userId);

  const listingId = `business-${crypto.randomUUID()}`;
  const { data: inserted, error: insertError } = await supabase
    .from('business_listings')
    .insert({
      business_name: value.businessName,
      category: value.category,
      contact_email: value.contactEmail,
      contact_phone: value.contactPhone,
      contact_website: value.contactWebsite,
      created_by: userId,
      description: value.description,
      hours: value.hours,
      address: value.address,
      current_special: value.currentSpecial,
      special_updated_at: value.currentSpecial ? new Date().toISOString() : null,
      id: listingId,
    })
    .select(BUSINESS_SELECT)
    .single();
  throwIfSupabaseError(insertError, 'create business listing');
  if (!inserted) {
    throw new Error('create business listing: database returned no listing.');
  }
  let insertedRow = inserted as unknown as BusinessRow;
  const nameById = await nameMapFor(supabase, [userId]);

  const [mediaResult, logoResult] = await Promise.all([
    uploadBusinessMedia(supabase, listingId, input),
    uploadBusinessLogo(supabase, listingId, input),
  ]);
  if (!mediaResult.ok || !logoResult.ok) {
    const uploadedUrls = [
      ...(mediaResult.ok ? mediaResult.media : mediaResult.uploaded).map(
        (media) => media.url,
      ),
      ...(logoResult.ok && logoResult.logo ? [logoResult.logo.url] : []),
    ];
    await removeStorageObjects(supabase, uploadedUrls);
    await supabase.from('business_listings').delete().eq('id', listingId);
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }

  if (mediaResult.media.length > 0 || logoResult.logo) {
    const { data: withMedia, error: updateError } = await supabase
      .from('business_listings')
      .update({ logo: logoResult.logo, media: mediaResult.media })
      .eq('id', listingId)
      .select(BUSINESS_SELECT)
      .single();
    throwIfSupabaseError(updateError, 'attach business listing media');
    insertedRow = (withMedia as unknown as BusinessRow) ?? insertedRow;
  }

  // Runs after media is attached so the classifier can see a real, public
  // photo URL rather than nothing -- see verification.ts.
  const photoUrl = logoResult.logo?.url ?? mediaResult.media[0]?.url ?? null;
  const verification = await resolveVerification(userId, value, photoUrl);
  if (verification.status === 'verified' || verification.notes) {
    const now = new Date().toISOString();
    const { data: verified, error: verifyError } = await supabase
      .from('business_listings')
      .update({
        verification_status: verification.status,
        verification_method: verification.method,
        verification_notes: verification.notes,
        verified_at: verification.status === 'verified' ? now : null,
        claimed_by: verification.status === 'verified' ? userId : null,
      })
      .eq('id', listingId)
      .select(BUSINESS_SELECT)
      .single();
    throwIfSupabaseError(verifyError, 'apply business listing verification');
    insertedRow = (verified as unknown as BusinessRow) ?? insertedRow;
  }

  return { listing: toBusinessListingView(insertedRow, nameById), ok: true };
}

export async function updateBusinessListingSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  input: unknown,
): Promise<UpdateBusinessListingResult> {
  const { data: existing, error: existingError } = await supabase
    .from('business_listings')
    .select('id,created_by,logo,media,business_name,contact_email,contact_website,verification_status,current_special')
    .eq('id', listingId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load business listing');
  if (!existing) {
    return {
      code: 'business_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }
  if (existing.created_by !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own listing.',
      ok: false,
    };
  }
  const validation = validateBusinessListingInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const keptMedia = extractExistingMedia(input);
  const keptLogo = extractExistingLogo(input);
  const [uploadResult, logoUploadResult] = await Promise.all([
    uploadBusinessMedia(supabase, listingId, input),
    uploadBusinessLogo(supabase, listingId, input),
  ]);
  if (!uploadResult.ok || !logoUploadResult.ok) {
    const uploadedUrls = [
      ...(uploadResult.ok ? [] : uploadResult.uploaded.map((media) => media.url)),
      ...(logoUploadResult.ok && logoUploadResult.logo
        ? [logoUploadResult.logo.url]
        : []),
    ];
    await removeStorageObjects(supabase, uploadedUrls);
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  const media = [...keptMedia, ...uploadResult.media];
  const logo = logoUploadResult.logo ?? keptLogo;

  const identityChanged =
    existing.business_name !== value.businessName ||
    existing.contact_email !== value.contactEmail ||
    existing.contact_website !== value.contactWebsite;
  const needsReverification = existing.verification_status === 'verified' && identityChanged;
  const photoUrl = logo?.url ?? media[0]?.url ?? null;
  const verification = needsReverification
    ? await resolveVerification(userId, value, photoUrl)
    : null;
  const now = new Date().toISOString();
  const specialChanged = existing.current_special !== value.currentSpecial;

  const { data, error } = await supabase
    .from('business_listings')
    .update({
      business_name: value.businessName,
      category: value.category,
      contact_email: value.contactEmail,
      contact_phone: value.contactPhone,
      contact_website: value.contactWebsite,
      description: value.description,
      hours: value.hours,
      address: value.address,
      current_special: value.currentSpecial,
      special_updated_at: specialChanged ? now : undefined,
      logo,
      media: media.length ? media : null,
      edited_at: now,
      ...(verification
        ? {
            verification_status: verification.status,
            verification_method: verification.method,
            verification_notes: verification.notes,
            verified_at: verification.status === 'verified' ? now : null,
            claimed_by: verification.status === 'verified' ? userId : null,
          }
        : {}),
    })
    .eq('id', listingId)
    .select(BUSINESS_SELECT)
    .single();
  throwIfSupabaseError(error, 'update business listing');
  if (!data) {
    throw new Error('update business listing: database returned no listing.');
  }

  const previousMedia = (existing.media as readonly BusinessMedia[] | null) ?? [];
  const keptUrls = new Set(keptMedia.map((item) => item.url));
  const removedMedia = previousMedia.filter((item) => !keptUrls.has(item.url));
  const previousLogo = existing.logo as BusinessMedia | null;
  const removedLogoUrls =
    previousLogo && previousLogo.url !== logo?.url ? [previousLogo.url] : [];
  await removeStorageObjects(supabase, [
    ...removedMedia.map((item) => item.url),
    ...removedLogoUrls,
  ]);

  const row = data as unknown as BusinessRow;
  const nameById = await nameMapFor(supabase, [userId]);
  return { listing: toBusinessListingView(row, nameById), ok: true };
}

export async function reportBusinessListingSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  submission: ValidReportSubmission,
): Promise<ReportBusinessListingResult> {
  const { data: listing, error: listingError } = await supabase
    .from('business_listings')
    .select('id')
    .eq('id', listingId)
    .maybeSingle();
  throwIfSupabaseError(listingError, 'load reported business listing');
  if (!listing) {
    return {
      code: 'business_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }

  await ensureUser(supabase, userId);
  const evidenceImageUrl = await uploadReportEvidence(
    supabase,
    userId,
    submission.evidenceImageDataUrl,
  );
  // Idempotent: a unique (business_listing_id, reporter_id) constraint on
  // business_listing_reports means a repeat report from the same user is a
  // silent no-op, not an error.
  const { error } = await supabase.from('business_listing_reports').upsert(
    {
      business_listing_id: listingId,
      details: submission.details,
      evidence_image_url: evidenceImageUrl,
      reason: submission.reason,
      reporter_id: userId,
    },
    { ignoreDuplicates: true, onConflict: 'business_listing_id,reporter_id' },
  );
  throwIfSupabaseError(error, 'report business listing');
  return { ok: true, reported: true };
}

export async function deleteBusinessListingSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<boolean> {
  const { data: existing, error: existingError } = await supabase
    .from('business_listings')
    .select('id,created_by,logo,media')
    .eq('id', listingId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load business listing');
  if (!existing || existing.created_by !== userId) {
    return false;
  }
  const media = (existing.media as readonly BusinessMedia[] | null) ?? [];
  const logo = existing.logo as BusinessMedia | null;
  await removeStorageObjects(supabase, [
    ...media.map((item) => item.url),
    ...(logo ? [logo.url] : []),
  ]);
  const { error } = await supabase
    .from('business_listings')
    .delete()
    .eq('id', listingId);
  throwIfSupabaseError(error, 'delete business listing');
  return true;
}

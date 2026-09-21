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

import { defaultDisplayName, type ServiceCategory } from '@/src/backend/store';

import type {
  CreatedServiceListingResult,
  MyServiceListingsPage,
  ServiceListing,
  ServiceMedia,
  ServicesPage,
  ServicesView,
  UpdateServiceListingResult,
} from './types';
import { validateServiceListingInput } from './validation';

const SERVICE_SELECT =
  'id,created_by,business_name,category,description,contact_phone,contact_email,contact_website,service_area,hours,logo,media,created_at,edited_at';

interface ServiceRow {
  readonly id: string;
  readonly created_by: string;
  readonly business_name: string;
  readonly category: string;
  readonly description: string;
  readonly contact_phone: string | null;
  readonly contact_email: string | null;
  readonly contact_website: string | null;
  readonly service_area: string | null;
  readonly hours: string | null;
  readonly logo: ServiceMedia | null;
  readonly media: readonly ServiceMedia[] | null;
  readonly created_at: string;
  readonly edited_at: string | null;
}

interface ReviewSummaryRow {
  readonly listing_id: string;
  readonly rating: number;
}

interface PersonLookup {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

type UploadServiceMediaResult =
  | { readonly ok: true; readonly media: readonly ServiceMedia[] }
  | { readonly ok: false; readonly uploaded: readonly ServiceMedia[] };

const ratingSummaryFrom = (
  rows: readonly ReviewSummaryRow[],
  listingId: string,
): { readonly averageRating: number | null; readonly reviewCount: number } => {
  const forListing = rows.filter((row) => row.listing_id === listingId);
  if (forListing.length === 0) {
    return { averageRating: null, reviewCount: 0 };
  }
  const total = forListing.reduce((sum, row) => sum + row.rating, 0);
  return {
    averageRating: Math.round((total / forListing.length) * 10) / 10,
    reviewCount: forListing.length,
  };
};

const toServiceListingView = (
  row: ServiceRow,
  nameById: ReadonlyMap<string, PersonLookup>,
  reviewRows: readonly ReviewSummaryRow[],
): ServiceListing => {
  const author = nameById.get(row.created_by);
  const { averageRating, reviewCount } = ratingSummaryFrom(reviewRows, row.id);
  return {
    id: row.id,
    author: {
      avatarUrl: author?.avatarUrl ?? null,
      id: row.created_by,
      isAdmin: author?.isAdmin ?? false,
      name: author?.name ?? 'Member',
    },
    businessName: row.business_name,
    category: row.category as ServiceCategory,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    contactWebsite: row.contact_website,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    description: row.description,
    hours: row.hours,
    logo: row.logo ?? undefined,
    media: row.media ?? undefined,
    averageRating,
    reviewCount,
    serviceArea: row.service_area,
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
  throwIfSupabaseError(error, 'load service listing authors');
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

const reviewRowsFor = async (
  supabase: SupabaseClient,
  listingIds: readonly string[],
): Promise<readonly ReviewSummaryRow[]> => {
  if (listingIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from('service_reviews')
    .select('listing_id,rating')
    .in('listing_id', listingIds);
  throwIfSupabaseError(error, 'load service reviews');
  return (data ?? []) as unknown as ReviewSummaryRow[];
};

const MEDIA_UPLOAD_FAILED_MESSAGE =
  'One or more images failed to upload. Please try again.';

// Uploads each picked image to Supabase Storage under the listing's own id.
// WHY: a failed upload is surfaced as `ok: false` (with whatever succeeded so
// far in `uploaded`) rather than silently dropped — matches missions-supabase.
const uploadServiceMedia = async (
  supabase: SupabaseClient,
  listingId: string,
  input: unknown,
): Promise<UploadServiceMediaResult> => {
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
        'services',
        listingId,
      );
      return url ? { filename: upload.filename, url } : null;
    }),
  );
  const succeeded = results.filter(
    (media): media is ServiceMedia => media !== null,
  );
  if (succeeded.length !== results.length) {
    return { ok: false, uploaded: succeeded };
  }
  return { media: succeeded, ok: true };
};

type UploadServiceLogoResult =
  | { readonly ok: true; readonly logo: ServiceMedia | null }
  | { readonly ok: false };

// Uploads a single logo image, mirroring uploadServiceMedia but for the one
// slot the card/icon box shows instead of the photo gallery.
const uploadServiceLogo = async (
  supabase: SupabaseClient,
  listingId: string,
  input: unknown,
): Promise<UploadServiceLogoResult> => {
  const upload = extractLogoUpload(input);
  if (!upload) {
    return { logo: null, ok: true };
  }
  const url = await uploadDataUrl(
    supabase,
    upload.dataUrl,
    upload.filename,
    'services',
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
  throwIfSupabaseError(error, 'ensure service listing user');
};

export async function getServicesViewSupabase(
  supabase: SupabaseClient,
  category: ServiceCategory | undefined,
): Promise<ServicesView> {
  const query = supabase
    .from('service_listings')
    .select(SERVICE_SELECT)
    .order('created_at', { ascending: false });
  const { data, error } = await (category ? query.eq('category', category) : query);
  throwIfSupabaseError(error, 'load service listings');
  const rows = (data ?? []) as unknown as ServiceRow[];

  const authorIds = [...new Set(rows.map((row) => row.created_by))];
  const [nameById, reviewRows] = await Promise.all([
    nameMapFor(supabase, authorIds),
    reviewRowsFor(
      supabase,
      rows.map((row) => row.id),
    ),
  ]);

  return {
    listings: rows.map((row) => toServiceListingView(row, nameById, reviewRows)),
  };
}

// The paginated, filtered counterpart to getServicesViewSupabase, mirroring
// getMyServiceListingsViewSupabase's precedent below: fetches the same rows,
// paginates in application code. createdAt already sorts newest-first via
// paginateInMemory's descending sort -- no sortKey inversion needed.
export async function listServicesPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  category: ServiceCategory | undefined,
  limit: number,
  cursor: string | null,
): Promise<ServicesPage> {
  const query = supabase
    .from('service_listings')
    .select(SERVICE_SELECT)
    .order('created_at', { ascending: false });
  const [{ data, error }, mutedUserIds] = await Promise.all([
    category ? query.eq('category', category) : query,
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load service listings');
  const mutedSet = new Set(mutedUserIds);
  const rows = ((data ?? []) as unknown as ServiceRow[]).filter(
    (row) => !mutedSet.has(row.created_by),
  );

  const wrapped = rows.map((row) => ({
    id: row.id,
    row,
    sortKey: row.created_at,
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  const authorIds = [...new Set(page.items.map((item) => item.row.created_by))];
  const [nameById, reviewRows] = await Promise.all([
    nameMapFor(supabase, authorIds),
    reviewRowsFor(
      supabase,
      page.items.map((item) => item.row.id),
    ),
  ]);

  return {
    listings: page.items.map((item) =>
      toServiceListingView(item.row, nameById, reviewRows),
    ),
    nextCursor: page.nextCursor,
  };
}

export async function getServicesByIdsSupabase(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<readonly ServiceListing[]> {
  const { data, error } = await supabase
    .from('service_listings')
    .select(SERVICE_SELECT)
    .in('id', ids);
  throwIfSupabaseError(error, 'load service listings by id');
  const rows = (data ?? []) as unknown as ServiceRow[];

  const authorIds = [...new Set(rows.map((row) => row.created_by))];
  const [nameById, reviewRows] = await Promise.all([
    nameMapFor(supabase, authorIds),
    reviewRowsFor(
      supabase,
      rows.map((row) => row.id),
    ),
  ]);

  return rows.map((row) => toServiceListingView(row, nameById, reviewRows));
}

export async function getMyServiceListingsViewSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
): Promise<MyServiceListingsPage> {
  const { data, error } = await supabase
    .from('service_listings')
    .select(SERVICE_SELECT)
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  throwIfSupabaseError(error, 'load my service listings');
  const rows = (data ?? []) as unknown as ServiceRow[];

  const wrapped = rows.map((row) => ({
    id: row.id,
    row,
    sortKey: row.created_at,
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  const authorIds = [...new Set(page.items.map((item) => item.row.created_by))];
  const [nameById, reviewRows] = await Promise.all([
    nameMapFor(supabase, authorIds),
    reviewRowsFor(
      supabase,
      page.items.map((item) => item.row.id),
    ),
  ]);

  return {
    listings: page.items.map((item) =>
      toServiceListingView(item.row, nameById, reviewRows),
    ),
    nextCursor: page.nextCursor,
  };
}

export async function createServiceListingSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<CreatedServiceListingResult> {
  const validation = validateServiceListingInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  await ensureUser(supabase, userId);

  const listingId = `svc-${crypto.randomUUID()}`;
  const { data: inserted, error: insertError } = await supabase
    .from('service_listings')
    .insert({
      business_name: value.businessName,
      category: value.category,
      contact_email: value.contactEmail,
      contact_phone: value.contactPhone,
      contact_website: value.contactWebsite,
      created_by: userId,
      description: value.description,
      hours: value.hours,
      id: listingId,
      service_area: value.serviceArea,
    })
    .select(SERVICE_SELECT)
    .single();
  throwIfSupabaseError(insertError, 'create service listing');
  if (!inserted) {
    throw new Error('create service listing: database returned no listing.');
  }
  const insertedRow = inserted as unknown as ServiceRow;
  const nameById = await nameMapFor(supabase, [userId]);

  const [mediaResult, logoResult] = await Promise.all([
    uploadServiceMedia(supabase, listingId, input),
    uploadServiceLogo(supabase, listingId, input),
  ]);
  if (!mediaResult.ok || !logoResult.ok) {
    const uploadedUrls = [
      ...(mediaResult.ok ? mediaResult.media : mediaResult.uploaded).map(
        (media) => media.url,
      ),
      ...(logoResult.ok && logoResult.logo ? [logoResult.logo.url] : []),
    ];
    await removeStorageObjects(supabase, uploadedUrls);
    await supabase.from('service_listings').delete().eq('id', listingId);
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  if (mediaResult.media.length === 0 && !logoResult.logo) {
    return { listing: toServiceListingView(insertedRow, nameById, []), ok: true };
  }

  const { data: updated, error: updateError } = await supabase
    .from('service_listings')
    .update({ logo: logoResult.logo, media: mediaResult.media })
    .eq('id', listingId)
    .select(SERVICE_SELECT)
    .single();
  throwIfSupabaseError(updateError, 'attach service listing media');
  return {
    listing: toServiceListingView(
      (updated as unknown as ServiceRow) ?? insertedRow,
      nameById,
      [],
    ),
    ok: true,
  };
}

export async function updateServiceListingSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  input: unknown,
): Promise<UpdateServiceListingResult> {
  const { data: existing, error: existingError } = await supabase
    .from('service_listings')
    .select('id,created_by,logo,media')
    .eq('id', listingId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load service listing');
  if (!existing) {
    return {
      code: 'service_listing_not_found',
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
  const validation = validateServiceListingInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const keptMedia = extractExistingMedia(input);
  const keptLogo = extractExistingLogo(input);
  const [uploadResult, logoUploadResult] = await Promise.all([
    uploadServiceMedia(supabase, listingId, input),
    uploadServiceLogo(supabase, listingId, input),
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

  const { data, error } = await supabase
    .from('service_listings')
    .update({
      business_name: value.businessName,
      category: value.category,
      contact_email: value.contactEmail,
      contact_phone: value.contactPhone,
      contact_website: value.contactWebsite,
      description: value.description,
      hours: value.hours,
      logo,
      media: media.length ? media : null,
      service_area: value.serviceArea,
      edited_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select(SERVICE_SELECT)
    .single();
  throwIfSupabaseError(error, 'update service listing');
  if (!data) {
    throw new Error('update service listing: database returned no listing.');
  }

  const previousMedia = (existing.media as readonly ServiceMedia[] | null) ?? [];
  const keptUrls = new Set(keptMedia.map((item) => item.url));
  const removedMedia = previousMedia.filter((item) => !keptUrls.has(item.url));
  const previousLogo = existing.logo as ServiceMedia | null;
  const removedLogoUrls =
    previousLogo && previousLogo.url !== logo?.url ? [previousLogo.url] : [];
  await removeStorageObjects(supabase, [
    ...removedMedia.map((item) => item.url),
    ...removedLogoUrls,
  ]);

  const row = data as unknown as ServiceRow;
  const nameById = await nameMapFor(supabase, [userId]);
  const reviewRows = await reviewRowsFor(supabase, [listingId]);
  return { listing: toServiceListingView(row, nameById, reviewRows), ok: true };
}

export async function deleteServiceListingSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<boolean> {
  const { data: existing, error: existingError } = await supabase
    .from('service_listings')
    .select('id,created_by,logo,media')
    .eq('id', listingId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load service listing');
  if (!existing || existing.created_by !== userId) {
    return false;
  }
  // WHY: clean up Storage before deleting the row — owner-scoped Storage RLS
  // verifies ownership by looking the listing back up, so the row must still
  // exist when the cleanup call runs (mirrors deleteMissionSupabase).
  const media = (existing.media as readonly ServiceMedia[] | null) ?? [];
  const logo = existing.logo as ServiceMedia | null;
  await removeStorageObjects(supabase, [
    ...media.map((item) => item.url),
    ...(logo ? [logo.url] : []),
  ]);
  const { error } = await supabase
    .from('service_listings')
    .delete()
    .eq('id', listingId);
  throwIfSupabaseError(error, 'delete service listing');
  return true;
}

import { extractLogoUpload, extractMediaUploads } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { setState, type StoredBusinessListing } from '@/src/backend/store';
import { CREATE_CONTENT_XP, grantXp, NO_XP_AWARD } from '@/src/backend/xp';

import { createBusinessListingSupabase } from './business-listings-supabase';
import { toBusinessListingView } from './business-listing-view';
import type { CreatedBusinessListingResult, CreateBusinessListingResult } from './types';
import { validateBusinessListingInput } from './validation';
import { resolveVerification } from './verification';

async function createBusinessListingMemory(
  userId: string,
  input: unknown,
): Promise<CreatedBusinessListingResult> {
  const validation = validateBusinessListingInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const mediaUploads = extractMediaUploads(input);
  const logoUpload = extractLogoUpload(input);
  // Memory-mode media is a data: URL, not a real public URL -- not a valid
  // Anthropic image `url` source, so the classifier only gets text fields
  // here. Fine for local/dev tooling; the Supabase path (where uploads
  // produce real public URLs before classification runs) is the one that
  // matters for production.
  const verification = await resolveVerification(userId, value, null);
  const now = new Date().toISOString();
  const stored: StoredBusinessListing = {
    id: `business-${crypto.randomUUID()}`,
    authorId: userId,
    businessName: value.businessName,
    category: value.category,
    description: value.description,
    contactPhone: value.contactPhone,
    contactEmail: value.contactEmail,
    contactWebsite: value.contactWebsite,
    address: value.address,
    hours: value.hours,
    currentSpecials: value.currentSpecials,
    specialsUpdatedAt: value.currentSpecials.length > 0 ? now : null,
    logo: logoUpload
      ? { filename: logoUpload.filename, url: logoUpload.dataUrl }
      : undefined,
    media: mediaUploads.length
      ? mediaUploads.map((upload) => ({
          filename: upload.filename,
          url: upload.dataUrl,
        }))
      : undefined,
    verificationStatus: verification.status,
    verificationMethod: verification.method,
    verificationNotes: verification.notes,
    verifiedAt: verification.status === 'verified' ? now : null,
    claimedBy: verification.status === 'verified' ? userId : null,
    createdAt: now,
    editedAt: null,
  };
  const next = setState((current) => ({
    ...current,
    businessListings: [...current.businessListings, stored],
  }));
  return {
    listing: toBusinessListingView(stored, next.users, next.businessListingReviews),
    ok: true,
  };
}

export async function createBusinessListing(
  ctx: RequestContext,
  input: unknown,
): Promise<CreateBusinessListingResult> {
  const result = ctx.supabase
    ? await createBusinessListingSupabase(ctx.supabase, ctx.userId, input)
    : await createBusinessListingMemory(ctx.userId, input);

  if (!result.ok) {
    return result;
  }

  // The listing is already fully saved by this point -- a failure in this
  // purely secondary XP grant must never make an otherwise-successful
  // listing creation look like it failed to the client. Mirrors
  // services/create.ts exactly.
  const xpAward = await grantXp(ctx, {
    amount: CREATE_CONTENT_XP,
    reason: 'business_listing_created',
    refId: result.listing.id,
  }).catch(() => NO_XP_AWARD);

  return { ...result, xpAward };
}

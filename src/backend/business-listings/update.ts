import {
  extractExistingLogo,
  extractExistingMedia,
  extractLogoUpload,
  extractMediaUploads,
} from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { updateBusinessListingSupabase } from './business-listings-supabase';
import { toBusinessListingView } from './business-listing-view';
import type { UpdateBusinessListingResult } from './types';
import { validateBusinessListingInput } from './validation';
import { resolveVerification } from './verification';

// Editing the fields verification was actually based on re-runs the
// pipeline; editing anything else (hours, special, address, photos)
// leaves an already-verified listing's status untouched.
const specialsChanged = (
  existing: readonly string[],
  next: readonly string[],
): boolean =>
  existing.length !== next.length || existing.some((special, index) => special !== next[index]);

const identityChanged = (
  existing: { businessName: string; contactEmail: string | null; contactWebsite: string | null },
  value: { businessName: string; contactEmail: string | null; contactWebsite: string | null },
): boolean =>
  existing.businessName !== value.businessName ||
  existing.contactEmail !== value.contactEmail ||
  existing.contactWebsite !== value.contactWebsite;

async function updateBusinessListingMemory(
  userId: string,
  listingId: string,
  input: unknown,
): Promise<UpdateBusinessListingResult> {
  const existing = getState().businessListings.find(
    (listing) => listing.id === listingId,
  );
  if (!existing) {
    return {
      code: 'business_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }
  if (existing.authorId !== userId) {
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
  const newMedia = extractMediaUploads(input);
  const media = [
    ...keptMedia,
    ...newMedia.map((upload) => ({
      filename: upload.filename,
      url: upload.dataUrl,
    })),
  ];
  const newLogo = extractLogoUpload(input);
  const keptLogo = extractExistingLogo(input);
  const logo = newLogo
    ? { filename: newLogo.filename, url: newLogo.dataUrl }
    : keptLogo
      ? { filename: keptLogo.filename, url: keptLogo.url }
      : undefined;

  const needsReverification =
    existing.verificationStatus === 'verified' && identityChanged(existing, value);
  const verification = needsReverification
    ? await resolveVerification(userId, value, null)
    : null;
  const now = new Date().toISOString();

  const next = setState((current) => ({
    ...current,
    businessListings: current.businessListings.map((listing) =>
      listing.id === listingId
        ? {
            ...listing,
            businessName: value.businessName,
            category: value.category,
            contactEmail: value.contactEmail,
            contactPhone: value.contactPhone,
            contactWebsite: value.contactWebsite,
            description: value.description,
            hours: value.hours,
            address: value.address,
            currentSpecials: value.currentSpecials,
            specialsUpdatedAt: specialsChanged(listing.currentSpecials, value.currentSpecials)
              ? now
              : listing.specialsUpdatedAt,
            logo,
            media: media.length ? media : undefined,
            ...(verification
              ? {
                  verificationStatus: verification.status,
                  verificationMethod: verification.method,
                  verificationNotes: verification.notes,
                  verifiedAt: verification.status === 'verified' ? now : null,
                  claimedBy: verification.status === 'verified' ? userId : null,
                }
              : {}),
            editedAt: now,
          }
        : listing,
    ),
  }));
  const updated = next.businessListings.find(
    (listing) => listing.id === listingId,
  );
  if (!updated) {
    return {
      code: 'business_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }
  return {
    listing: toBusinessListingView(updated, next.users, next.businessListingReviews),
    ok: true,
  };
}

export async function updateBusinessListing(
  ctx: RequestContext,
  listingId: string,
  input: unknown,
): Promise<UpdateBusinessListingResult> {
  return ctx.supabase
    ? updateBusinessListingSupabase(ctx.supabase, ctx.userId, listingId, input)
    : updateBusinessListingMemory(ctx.userId, listingId, input);
}

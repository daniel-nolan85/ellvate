import {
  extractExistingLogo,
  extractExistingMedia,
  extractLogoUpload,
  extractMediaUploads,
} from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { updateServiceListingSupabase } from './services-supabase';
import { toServiceListingView } from './service-view';
import type { UpdateServiceListingResult } from './types';
import { validateServiceListingInput } from './validation';

function updateServiceListingMemory(
  userId: string,
  listingId: string,
  input: unknown,
): UpdateServiceListingResult {
  const existing = getState().serviceListings.find(
    (listing) => listing.id === listingId,
  );
  if (!existing) {
    return {
      code: 'service_listing_not_found',
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
  const validation = validateServiceListingInput(input);
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
  const next = setState((current) => ({
    ...current,
    serviceListings: current.serviceListings.map((listing) =>
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
            logo,
            media: media.length ? media : undefined,
            serviceArea: value.serviceArea,
            editedAt: new Date().toISOString(),
          }
        : listing,
    ),
  }));
  const updated = next.serviceListings.find(
    (listing) => listing.id === listingId,
  );
  if (!updated) {
    return {
      code: 'service_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }
  return {
    listing: toServiceListingView(updated, next.users, next.serviceReviews),
    ok: true,
  };
}

export async function updateServiceListing(
  ctx: RequestContext,
  listingId: string,
  input: unknown,
): Promise<UpdateServiceListingResult> {
  return ctx.supabase
    ? updateServiceListingSupabase(ctx.supabase, ctx.userId, listingId, input)
    : updateServiceListingMemory(ctx.userId, listingId, input);
}

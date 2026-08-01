import { extractLogoUpload, extractMediaUploads } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { setState, type StoredServiceListing } from '@/src/backend/store';

import { createServiceListingSupabase } from './services-supabase';
import { toServiceListingView } from './service-view';
import type { CreateServiceListingResult } from './types';
import { validateServiceListingInput } from './validation';

function createServiceListingMemory(
  userId: string,
  input: unknown,
): CreateServiceListingResult {
  const validation = validateServiceListingInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const mediaUploads = extractMediaUploads(input);
  const logoUpload = extractLogoUpload(input);
  const stored: StoredServiceListing = {
    id: `svc-${crypto.randomUUID()}`,
    authorId: userId,
    businessName: value.businessName,
    category: value.category,
    description: value.description,
    contactPhone: value.contactPhone,
    contactEmail: value.contactEmail,
    contactWebsite: value.contactWebsite,
    serviceArea: value.serviceArea,
    hours: value.hours,
    logo: logoUpload
      ? { filename: logoUpload.filename, url: logoUpload.dataUrl }
      : undefined,
    media: mediaUploads.length
      ? mediaUploads.map((upload) => ({
          filename: upload.filename,
          url: upload.dataUrl,
        }))
      : undefined,
    createdAt: new Date().toISOString(),
  };
  const next = setState((current) => ({
    ...current,
    serviceListings: [...current.serviceListings, stored],
  }));
  return {
    listing: toServiceListingView(stored, next.users, next.serviceReviews),
    ok: true,
  };
}

export async function createServiceListing(
  ctx: RequestContext,
  input: unknown,
): Promise<CreateServiceListingResult> {
  return ctx.supabase
    ? createServiceListingSupabase(ctx.supabase, ctx.userId, input)
    : createServiceListingMemory(ctx.userId, input);
}

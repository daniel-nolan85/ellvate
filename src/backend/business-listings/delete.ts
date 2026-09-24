import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { deleteBusinessListingSupabase } from './business-listings-supabase';

function deleteBusinessListingMemory(userId: string, listingId: string): boolean {
  const existing = getState().businessListings.find(
    (listing) => listing.id === listingId && listing.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    businessListings: current.businessListings.filter(
      (listing) => listing.id !== listingId,
    ),
    businessListingReports: current.businessListingReports.filter(
      (report) => report.businessListingId !== listingId,
    ),
  }));
  return true;
}

export async function deleteBusinessListing(
  ctx: RequestContext,
  listingId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteBusinessListingSupabase(ctx.supabase, ctx.userId, listingId)
    : deleteBusinessListingMemory(ctx.userId, listingId);
}

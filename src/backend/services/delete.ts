import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { deleteServiceListingSupabase } from './services-supabase';

function deleteServiceListingMemory(userId: string, listingId: string): boolean {
  const existing = getState().serviceListings.find(
    (listing) => listing.id === listingId && listing.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => {
    const removedReviewIds = new Set(
      current.serviceReviews
        .filter((review) => review.listingId === listingId)
        .map((review) => review.id),
    );
    return {
      ...current,
      serviceListings: current.serviceListings.filter(
        (listing) => listing.id !== listingId,
      ),
      serviceReviewReports: current.serviceReviewReports.filter(
        (report) => !removedReviewIds.has(report.serviceReviewId),
      ),
      serviceReviews: current.serviceReviews.filter(
        (review) => review.listingId !== listingId,
      ),
    };
  });
  return true;
}

export async function deleteServiceListing(
  ctx: RequestContext,
  listingId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteServiceListingSupabase(ctx.supabase, ctx.userId, listingId)
    : deleteServiceListingMemory(ctx.userId, listingId);
}

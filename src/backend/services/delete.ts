import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';
import { revokeXp } from '@/src/backend/xp';

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
  const deleted = ctx.supabase
    ? await deleteServiceListingSupabase(ctx.supabase, ctx.userId, listingId)
    : deleteServiceListingMemory(ctx.userId, listingId);
  // Supabase mode: a matching AFTER DELETE trigger on service_listings does
  // this atomically with the delete itself -- see
  // supabase/migrations/0074_revoke_xp_on_delete.sql -- so revokeXp no-ops
  // there; this only does real work in memory mode.
  if (deleted) {
    revokeXp(ctx, { reason: 'service_created', refId: listingId });
  }
  return deleted;
}

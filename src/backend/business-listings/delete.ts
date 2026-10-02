import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';
import { revokeXp } from '@/src/backend/xp';

import { deleteBusinessListingSupabase } from './business-listings-supabase';

function deleteBusinessListingMemory(userId: string, listingId: string): boolean {
  const existing = getState().businessListings.find(
    (listing) => listing.id === listingId && listing.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => {
    const removedReviewIds = new Set(
      current.businessListingReviews
        .filter((review) => review.listingId === listingId)
        .map((review) => review.id),
    );
    return {
      ...current,
      businessListings: current.businessListings.filter(
        (listing) => listing.id !== listingId,
      ),
      businessListingReports: current.businessListingReports.filter(
        (report) => report.businessListingId !== listingId,
      ),
      businessListingReviewReports: current.businessListingReviewReports.filter(
        (report) => !removedReviewIds.has(report.businessListingReviewId),
      ),
      businessListingReviews: current.businessListingReviews.filter(
        (review) => review.listingId !== listingId,
      ),
    };
  });
  return true;
}

export async function deleteBusinessListing(
  ctx: RequestContext,
  listingId: string,
): Promise<boolean> {
  const deleted = ctx.supabase
    ? await deleteBusinessListingSupabase(ctx.supabase, ctx.userId, listingId)
    : deleteBusinessListingMemory(ctx.userId, listingId);
  // Supabase mode: a matching AFTER DELETE trigger on business_listings
  // does this atomically with the delete itself -- see
  // supabase/migrations/0074_revoke_xp_on_delete.sql -- so revokeXp no-ops
  // there; this only does real work in memory mode.
  if (deleted) {
    revokeXp(ctx, { reason: 'business_listing_created', refId: listingId });
  }
  return deleted;
}

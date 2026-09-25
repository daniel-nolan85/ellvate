import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  setState,
  type StoredBusinessListing,
  type StoredBusinessListingReview,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import type { ValidReportSubmission } from '../reports/report-submission';
import {
  createBusinessListingReviewSupabase,
  deleteBusinessListingReviewSupabase,
  listBusinessListingReviewsPageSupabase,
  listBusinessListingReviewsSupabase,
  reportBusinessListingReviewSupabase,
  updateBusinessListingReviewSupabase,
} from './business-listing-reviews-supabase';
import type {
  CreateBusinessListingReviewResult,
  PersonRef,
  ReportBusinessListingReviewResult,
  BusinessListingReview,
  BusinessListingReviewsPage,
  UpdateBusinessListingReviewResult,
} from './types';

export const DEFAULT_BUSINESS_LISTING_REVIEWS_PAGE_SIZE = 20;
export const MAX_BUSINESS_LISTING_REVIEWS_PAGE_SIZE = 50;

const VALID_RATINGS = new Set([1, 2, 3, 4, 5]);
const MAX_REVIEW_BODY_LENGTH = 1000;

function validateRating(input: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const rating =
    typeof raw.rating === 'number' ? raw.rating : Number(raw.rating);
  return VALID_RATINGS.has(rating) ? (rating as 1 | 2 | 3 | 4 | 5) : null;
}

type ReviewBodyValidation =
  | { readonly ok: true; readonly body: string | null }
  | { readonly ok: false; readonly message: string };

// WHY: unlike a forum/mission/event comment, a star rating alone is a
// complete review — text is optional. Mirrors validateCommentBody's
// trim/length-limit handling but never rejects an empty body.
function validateReviewBody(input: unknown): ReviewBodyValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const trimmed = typeof raw.body === 'string' ? raw.body.trim() : '';
  if (trimmed.length > MAX_REVIEW_BODY_LENGTH) {
    return { ok: false, message: 'The review is too long.' };
  }
  return { body: trimmed || null, ok: true };
}

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

// Real Postgres RLS restricts every select on business_listing_reviews to
// reviews whose parent listing is itself visible -- `verification_status =
// 'verified' OR created_by = self` (see migration 0069, mirroring 0066's
// same rule on business_listings itself). Memory mode has no RLS, so every
// memory-mode list function below must apply this same rule by hand, joined
// against the review's parent listing. The Supabase-backed functions in
// business-listing-reviews-supabase.ts deliberately apply no such filter --
// RLS already did it before the rows reached them (same split as
// business-listings-view.ts's own isVisible filter for listings).
const isListingVisible = (listing: StoredBusinessListing, userId: string): boolean =>
  listing.verificationStatus === 'verified' || listing.authorId === userId;

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, isAdmin: user.isAdmin, name: user.name }
    : { avatarUrl: null, id, isAdmin: false, name: 'Member' };
};

const toBusinessListingReview = (
  stored: StoredBusinessListingReview,
  users: readonly StoredUser[],
): BusinessListingReview => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
  editedAt: stored.editedAt,
  id: stored.id,
  listingId: stored.listingId,
  rating: stored.rating,
});

function listBusinessListingReviewsMemory(
  userId: string,
  listingId: string,
): readonly BusinessListingReview[] {
  const state = getState();
  const listing = state.businessListings.find((candidate) => candidate.id === listingId);
  if (!listing || !isListingVisible(listing, userId)) {
    return [];
  }
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  return state.businessListingReviews
    .filter(
      (review) =>
        review.listingId === listingId && !mutedUserIds.has(review.authorId),
    )
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((review) => toBusinessListingReview(review, state.users));
}

// The paginated counterpart to listBusinessListingReviewsMemory (used by the
// public review list; the unbounded function stays available for internal
// callers). Newest-first, matching the existing order -- unlike
// missions/events/comments, no sortKey inversion is needed here since
// paginateInMemory already sorts descending and createdAt-descending is
// already the desired newest-first order (same as service reviews).
function listBusinessListingReviewsPageMemory(
  userId: string,
  listingId: string,
  limit: number,
  cursor: string | null,
): BusinessListingReviewsPage {
  const state = getState();
  const listing = state.businessListings.find((candidate) => candidate.id === listingId);
  if (!listing || !isListingVisible(listing, userId)) {
    return { nextCursor: null, reviews: [] };
  }
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const filtered = state.businessListingReviews
    .filter(
      (review) =>
        review.listingId === listingId && !mutedUserIds.has(review.authorId),
    )
    .map((review) => ({
      id: review.id,
      review,
      sortKey: review.createdAt,
    }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    nextCursor: page.nextCursor,
    reviews: page.items.map((item) => toBusinessListingReview(item.review, state.users)),
  };
}

function createBusinessListingReviewMemory(
  userId: string,
  listingId: string,
  input: unknown,
): CreateBusinessListingReviewResult {
  const bodyValidation = validateReviewBody(input);
  if (!bodyValidation.ok) {
    return { code: 'invalid_review', message: bodyValidation.message, ok: false };
  }
  const rating = validateRating(input);
  if (rating === null) {
    return {
      code: 'invalid_review',
      message: 'A rating between 1 and 5 is required.',
      ok: false,
    };
  }
  const listing = getState().businessListings.find(
    (candidate) => candidate.id === listingId,
  );
  if (!listing) {
    return {
      code: 'business_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }
  if (listing.authorId === userId) {
    return {
      code: 'forbidden',
      message: 'You can’t review your own listing.',
      ok: false,
    };
  }
  if (
    getState().businessListingReviews.some(
      (review) => review.listingId === listingId && review.authorId === userId,
    )
  ) {
    return {
      code: 'already_reviewed',
      message: 'You’ve already reviewed this listing — edit your existing review instead.',
      ok: false,
    };
  }
  const stored: StoredBusinessListingReview = {
    authorId: userId,
    body: bodyValidation.body,
    createdAt: new Date().toISOString(),
    editedAt: null,
    id: `business-review-${crypto.randomUUID()}`,
    listingId,
    rating,
  };
  const next = setState((current) => ({
    ...current,
    businessListingReviews: [...current.businessListingReviews, stored],
  }));
  return { ok: true, review: toBusinessListingReview(stored, next.users) };
}

function updateBusinessListingReviewMemory(
  userId: string,
  reviewId: string,
  input: unknown,
): UpdateBusinessListingReviewResult {
  const existing = getState().businessListingReviews.find(
    (review) => review.id === reviewId,
  );
  if (!existing) {
    return {
      code: 'business_listing_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  if (existing.authorId !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own review.',
      ok: false,
    };
  }
  const bodyValidation = validateReviewBody(input);
  if (!bodyValidation.ok) {
    return { code: 'invalid_review', message: bodyValidation.message, ok: false };
  }
  const rating = validateRating(input);
  if (rating === null) {
    return {
      code: 'invalid_review',
      message: 'A rating between 1 and 5 is required.',
      ok: false,
    };
  }
  const next = setState((current) => ({
    ...current,
    businessListingReviews: current.businessListingReviews.map((review) =>
      review.id === reviewId
        ? {
            ...review,
            body: bodyValidation.body,
            rating,
            editedAt: new Date().toISOString(),
          }
        : review,
    ),
  }));
  const updated = next.businessListingReviews.find((review) => review.id === reviewId);
  if (!updated) {
    return {
      code: 'business_listing_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  return { ok: true, review: toBusinessListingReview(updated, next.users) };
}

function deleteBusinessListingReviewMemory(userId: string, reviewId: string): boolean {
  const existing = getState().businessListingReviews.find(
    (review) => review.id === reviewId && review.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    businessListingReviewReports: current.businessListingReviewReports.filter(
      (report) => report.businessListingReviewId !== reviewId,
    ),
    businessListingReviews: current.businessListingReviews.filter(
      (review) => review.id !== reviewId,
    ),
  }));
  return true;
}

function reportBusinessListingReviewMemory(
  userId: string,
  reviewId: string,
  submission: ValidReportSubmission,
): ReportBusinessListingReviewResult {
  if (!getState().businessListingReviews.some((review) => review.id === reviewId)) {
    return {
      code: 'business_listing_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().businessListingReviewReports.some(
    (report) =>
      report.businessListingReviewId === reviewId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      businessListingReviewReports: [
        ...current.businessListingReviewReports,
        {
          businessListingReviewId: reviewId,
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `business-review-report-${crypto.randomUUID()}`,
          reason: submission.reason,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function listBusinessListingReviews(
  ctx: RequestContext,
  listingId: string,
): Promise<readonly BusinessListingReview[]> {
  return ctx.supabase
    ? listBusinessListingReviewsSupabase(ctx.supabase, ctx.userId, listingId)
    : listBusinessListingReviewsMemory(ctx.userId, listingId);
}

// The paginated, public-facing counterpart to listBusinessListingReviews.
export async function listBusinessListingReviewsPage(
  ctx: RequestContext,
  listingId: string,
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<BusinessListingReviewsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_BUSINESS_LISTING_REVIEWS_PAGE_SIZE),
    MAX_BUSINESS_LISTING_REVIEWS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listBusinessListingReviewsPageSupabase(ctx.supabase, ctx.userId, listingId, limit, cursor)
    : listBusinessListingReviewsPageMemory(ctx.userId, listingId, limit, cursor);
}

export async function createBusinessListingReview(
  ctx: RequestContext,
  listingId: string,
  input: unknown,
): Promise<CreateBusinessListingReviewResult> {
  return ctx.supabase
    ? createBusinessListingReviewSupabase(ctx.supabase, ctx.userId, listingId, input)
    : createBusinessListingReviewMemory(ctx.userId, listingId, input);
}

export async function updateBusinessListingReview(
  ctx: RequestContext,
  reviewId: string,
  input: unknown,
): Promise<UpdateBusinessListingReviewResult> {
  return ctx.supabase
    ? updateBusinessListingReviewSupabase(ctx.supabase, ctx.userId, reviewId, input)
    : updateBusinessListingReviewMemory(ctx.userId, reviewId, input);
}

export async function deleteBusinessListingReview(
  ctx: RequestContext,
  reviewId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteBusinessListingReviewSupabase(ctx.supabase, ctx.userId, reviewId)
    : deleteBusinessListingReviewMemory(ctx.userId, reviewId);
}

export async function reportBusinessListingReview(
  ctx: RequestContext,
  reviewId: string,
  submission: ValidReportSubmission,
): Promise<ReportBusinessListingReviewResult> {
  return ctx.supabase
    ? reportBusinessListingReviewSupabase(ctx.supabase, ctx.userId, reviewId, submission)
    : reportBusinessListingReviewMemory(ctx.userId, reviewId, submission);
}

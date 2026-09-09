import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  setState,
  type StoredServiceReview,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import type { ValidReportSubmission } from '../reports/report-submission';
import {
  createServiceReviewSupabase,
  deleteServiceReviewSupabase,
  listServiceReviewsPageSupabase,
  listServiceReviewsSupabase,
  reportServiceReviewSupabase,
  updateServiceReviewSupabase,
} from './service-reviews-supabase';
import type {
  CreateServiceReviewResult,
  PersonRef,
  ReportServiceReviewResult,
  ServiceReview,
  ServiceReviewsPage,
  UpdateServiceReviewResult,
} from './types';

export const DEFAULT_SERVICE_REVIEWS_PAGE_SIZE = 20;
export const MAX_SERVICE_REVIEWS_PAGE_SIZE = 50;

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

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, isAdmin: user.isAdmin, name: user.name }
    : { avatarUrl: null, id, isAdmin: false, name: 'Member' };
};

const toServiceReview = (
  stored: StoredServiceReview,
  users: readonly StoredUser[],
): ServiceReview => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
  editedAt: stored.editedAt,
  id: stored.id,
  listingId: stored.listingId,
  rating: stored.rating,
});

function listServiceReviewsMemory(
  userId: string,
  listingId: string,
): readonly ServiceReview[] {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  return state.serviceReviews
    .filter(
      (review) =>
        review.listingId === listingId && !mutedUserIds.has(review.authorId),
    )
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((review) => toServiceReview(review, state.users));
}

// The paginated counterpart to listServiceReviewsMemory (used by the public
// review list; the unbounded function stays available for internal
// callers). Newest-first, matching the existing order -- unlike
// missions/events/comments, no sortKey inversion is needed here since
// paginateInMemory already sorts descending and createdAt-descending is
// already the desired newest-first order (same as services listings).
function listServiceReviewsPageMemory(
  userId: string,
  listingId: string,
  limit: number,
  cursor: string | null,
): ServiceReviewsPage {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const filtered = state.serviceReviews
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
    reviews: page.items.map((item) => toServiceReview(item.review, state.users)),
  };
}

function createServiceReviewMemory(
  userId: string,
  listingId: string,
  input: unknown,
): CreateServiceReviewResult {
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
  const listing = getState().serviceListings.find(
    (candidate) => candidate.id === listingId,
  );
  if (!listing) {
    return {
      code: 'service_listing_not_found',
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
    getState().serviceReviews.some(
      (review) => review.listingId === listingId && review.authorId === userId,
    )
  ) {
    return {
      code: 'already_reviewed',
      message: 'You’ve already reviewed this listing — edit your existing review instead.',
      ok: false,
    };
  }
  const stored: StoredServiceReview = {
    authorId: userId,
    body: bodyValidation.body,
    createdAt: new Date().toISOString(),
    editedAt: null,
    id: `svc-review-${crypto.randomUUID()}`,
    listingId,
    rating,
  };
  const next = setState((current) => ({
    ...current,
    serviceReviews: [...current.serviceReviews, stored],
  }));
  return { ok: true, review: toServiceReview(stored, next.users) };
}

function updateServiceReviewMemory(
  userId: string,
  reviewId: string,
  input: unknown,
): UpdateServiceReviewResult {
  const existing = getState().serviceReviews.find(
    (review) => review.id === reviewId,
  );
  if (!existing) {
    return {
      code: 'service_review_not_found',
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
    serviceReviews: current.serviceReviews.map((review) =>
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
  const updated = next.serviceReviews.find((review) => review.id === reviewId);
  if (!updated) {
    return {
      code: 'service_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  return { ok: true, review: toServiceReview(updated, next.users) };
}

function deleteServiceReviewMemory(userId: string, reviewId: string): boolean {
  const existing = getState().serviceReviews.find(
    (review) => review.id === reviewId && review.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    serviceReviewReports: current.serviceReviewReports.filter(
      (report) => report.serviceReviewId !== reviewId,
    ),
    serviceReviews: current.serviceReviews.filter(
      (review) => review.id !== reviewId,
    ),
  }));
  return true;
}

function reportServiceReviewMemory(
  userId: string,
  reviewId: string,
  submission: ValidReportSubmission,
): ReportServiceReviewResult {
  if (!getState().serviceReviews.some((review) => review.id === reviewId)) {
    return {
      code: 'service_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().serviceReviewReports.some(
    (report) =>
      report.serviceReviewId === reviewId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      serviceReviewReports: [
        ...current.serviceReviewReports,
        {
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `svc-review-report-${crypto.randomUUID()}`,
          reason: submission.reason,
          reporterId: userId,
          serviceReviewId: reviewId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function listServiceReviews(
  ctx: RequestContext,
  listingId: string,
): Promise<readonly ServiceReview[]> {
  return ctx.supabase
    ? listServiceReviewsSupabase(ctx.supabase, ctx.userId, listingId)
    : listServiceReviewsMemory(ctx.userId, listingId);
}

// The paginated, public-facing counterpart to listServiceReviews.
export async function listServiceReviewsPage(
  ctx: RequestContext,
  listingId: string,
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<ServiceReviewsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_SERVICE_REVIEWS_PAGE_SIZE),
    MAX_SERVICE_REVIEWS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listServiceReviewsPageSupabase(ctx.supabase, ctx.userId, listingId, limit, cursor)
    : listServiceReviewsPageMemory(ctx.userId, listingId, limit, cursor);
}

export async function createServiceReview(
  ctx: RequestContext,
  listingId: string,
  input: unknown,
): Promise<CreateServiceReviewResult> {
  return ctx.supabase
    ? createServiceReviewSupabase(ctx.supabase, ctx.userId, listingId, input)
    : createServiceReviewMemory(ctx.userId, listingId, input);
}

export async function updateServiceReview(
  ctx: RequestContext,
  reviewId: string,
  input: unknown,
): Promise<UpdateServiceReviewResult> {
  return ctx.supabase
    ? updateServiceReviewSupabase(ctx.supabase, ctx.userId, reviewId, input)
    : updateServiceReviewMemory(ctx.userId, reviewId, input);
}

export async function deleteServiceReview(
  ctx: RequestContext,
  reviewId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteServiceReviewSupabase(ctx.supabase, ctx.userId, reviewId)
    : deleteServiceReviewMemory(ctx.userId, reviewId);
}

export async function reportServiceReview(
  ctx: RequestContext,
  reviewId: string,
  submission: ValidReportSubmission,
): Promise<ReportServiceReviewResult> {
  return ctx.supabase
    ? reportServiceReviewSupabase(ctx.supabase, ctx.userId, reviewId, submission)
    : reportServiceReviewMemory(ctx.userId, reviewId, submission);
}

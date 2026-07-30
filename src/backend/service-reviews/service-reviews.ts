import { validateCommentBody } from '@/src/backend/comments';
import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  setState,
  type StoredServiceReview,
  type StoredUser,
} from '@/src/backend/store';

import {
  createServiceReviewSupabase,
  deleteServiceReviewSupabase,
  listServiceReviewsSupabase,
  reportServiceReviewSupabase,
  updateServiceReviewSupabase,
} from './service-reviews-supabase';
import type {
  CreateServiceReviewResult,
  PersonRef,
  ReportServiceReviewResult,
  ServiceReview,
  UpdateServiceReviewResult,
} from './types';

const VALID_RATINGS = new Set([1, 2, 3, 4, 5]);

function validateRating(input: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const rating =
    typeof raw.rating === 'number' ? raw.rating : Number(raw.rating);
  return VALID_RATINGS.has(rating) ? (rating as 1 | 2 | 3 | 4 | 5) : null;
}

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id, name: 'Member' };
};

const toServiceReview = (
  stored: StoredServiceReview,
  users: readonly StoredUser[],
): ServiceReview => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
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

function createServiceReviewMemory(
  userId: string,
  listingId: string,
  input: unknown,
): CreateServiceReviewResult {
  const bodyValidation = validateCommentBody(input);
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
  const stored: StoredServiceReview = {
    authorId: userId,
    body: bodyValidation.body,
    createdAt: new Date().toISOString(),
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
      code: 'service_review_not_found',
      message: 'You can only edit your own review.',
      ok: false,
    };
  }
  const bodyValidation = validateCommentBody(input);
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
        ? { ...review, body: bodyValidation.body, rating }
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
          id: `svc-review-report-${crypto.randomUUID()}`,
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
): Promise<ReportServiceReviewResult> {
  return ctx.supabase
    ? reportServiceReviewSupabase(ctx.supabase, ctx.userId, reviewId)
    : reportServiceReviewMemory(ctx.userId, reviewId);
}

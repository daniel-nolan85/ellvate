import type { SupabaseClient } from '@supabase/supabase-js';

import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { defaultDisplayName } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { uploadReportEvidence, type ValidReportSubmission } from '../reports/report-submission';
import type {
  CreateBusinessListingReviewResult,
  ReportBusinessListingReviewResult,
  BusinessListingReview,
  BusinessListingReviewsPage,
  UpdateBusinessListingReviewResult,
} from './types';

const BUSINESS_LISTING_REVIEW_SELECT =
  'id,listing_id,author_id,rating,body,created_at,edited_at,author:app_users!business_listing_reviews_author_id_fkey(id,name,avatar_url,is_admin)';

interface BusinessListingReviewRow {
  readonly id: string;
  readonly listing_id: string;
  readonly author_id: string;
  readonly rating: number;
  readonly body: string | null;
  readonly created_at: string;
  readonly edited_at: string | null;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

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

const toBusinessListingReview = (row: BusinessListingReviewRow): BusinessListingReview => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    isAdmin: row.author?.is_admin ?? false,
    name: row.author?.name ?? 'Member',
  },
  body: row.body,
  createdAt: row.created_at,
  editedAt: row.edited_at,
  id: row.id,
  listingId: row.listing_id,
  rating: row.rating as 1 | 2 | 3 | 4 | 5,
});

const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert(
      { id: userId, name: defaultDisplayName(userId) },
      { ignoreDuplicates: true, onConflict: 'id' },
    );
  throwIfSupabaseError(error, 'ensure business listing review user');
};

// No visibility filter applied here on top of the query -- RLS (migration
// 0069) already restricts every select on business_listing_reviews to
// reviews whose parent listing is itself visible before the rows reach this
// function, mirroring business-listings-supabase.ts's own comment for
// business_listings itself.
export async function listBusinessListingReviewsSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<readonly BusinessListingReview[]> {
  const [{ data, error }, mutedUserIds] = await Promise.all([
    supabase
      .from('business_listing_reviews')
      .select(BUSINESS_LISTING_REVIEW_SELECT)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false }),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load business listing reviews');
  const mutedSet = new Set(mutedUserIds);
  return (data as unknown as BusinessListingReviewRow[])
    .filter((row) => !mutedSet.has(row.author_id))
    .map(toBusinessListingReview);
}

// The paginated counterpart to listBusinessListingReviewsSupabase, mirroring
// the fetch-then-paginate-in-application-code precedent used across this
// codebase's Supabase backends. Newest-first, matching the existing order --
// no sortKey inversion needed since paginateInMemory already sorts
// descending and createdAt-descending is the desired order (same as service
// reviews' Supabase backend).
export async function listBusinessListingReviewsPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  limit: number,
  cursor: string | null,
): Promise<BusinessListingReviewsPage> {
  const [{ data, error }, mutedUserIds] = await Promise.all([
    supabase
      .from('business_listing_reviews')
      .select(BUSINESS_LISTING_REVIEW_SELECT)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false }),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load business listing reviews');
  const mutedSet = new Set(mutedUserIds);
  const rows = (data as unknown as BusinessListingReviewRow[]).filter(
    (row) => !mutedSet.has(row.author_id),
  );

  const wrapped = rows.map((row) => ({
    id: row.id,
    row,
    sortKey: row.created_at,
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    nextCursor: page.nextCursor,
    reviews: page.items.map((item) => toBusinessListingReview(item.row)),
  };
}

export async function createBusinessListingReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  input: unknown,
): Promise<CreateBusinessListingReviewResult> {
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
  const { data: listing, error: listingError } = await supabase
    .from('business_listings')
    .select('id,created_by')
    .eq('id', listingId)
    .maybeSingle();
  throwIfSupabaseError(listingError, 'load review listing');
  if (!listing) {
    return {
      code: 'business_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }
  if (listing.created_by === userId) {
    return {
      code: 'forbidden',
      message: 'You can’t review your own listing.',
      ok: false,
    };
  }
  const { data: existingReview, error: existingReviewError } = await supabase
    .from('business_listing_reviews')
    .select('id')
    .eq('listing_id', listingId)
    .eq('author_id', userId)
    .maybeSingle();
  throwIfSupabaseError(existingReviewError, 'check existing business listing review');
  if (existingReview) {
    return {
      code: 'already_reviewed',
      message: 'You’ve already reviewed this listing — edit your existing review instead.',
      ok: false,
    };
  }
  await ensureUser(supabase, userId);
  const { data, error } = await supabase
    .from('business_listing_reviews')
    .insert({
      author_id: userId,
      body: bodyValidation.body,
      listing_id: listingId,
      rating,
    })
    .select(BUSINESS_LISTING_REVIEW_SELECT)
    .single();
  throwIfSupabaseError(error, 'create business listing review');
  if (!data) {
    throw new Error('create business listing review: database returned no review.');
  }
  return {
    ok: true,
    review: toBusinessListingReview(data as unknown as BusinessListingReviewRow),
  };
}

export async function updateBusinessListingReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  input: unknown,
): Promise<UpdateBusinessListingReviewResult> {
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
  const { data: existing, error: existingError } = await supabase
    .from('business_listing_reviews')
    .select('author_id')
    .eq('id', reviewId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load business listing review for update');
  if (!existing) {
    return {
      code: 'business_listing_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  if (existing.author_id !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own review.',
      ok: false,
    };
  }
  const { data, error } = await supabase
    .from('business_listing_reviews')
    .update({
      body: bodyValidation.body,
      rating,
      edited_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('author_id', userId)
    .select(BUSINESS_LISTING_REVIEW_SELECT)
    .maybeSingle();
  throwIfSupabaseError(error, 'update business listing review');
  if (!data) {
    return {
      code: 'business_listing_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  return { ok: true, review: toBusinessListingReview(data as unknown as BusinessListingReviewRow) };
}

export async function deleteBusinessListingReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('business_listing_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('author_id', userId)
    .select('id');
  throwIfSupabaseError(error, 'delete business listing review');
  return Array.isArray(data) && data.length > 0;
}

export async function reportBusinessListingReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  submission: ValidReportSubmission,
): Promise<ReportBusinessListingReviewResult> {
  const { data: review, error: reviewError } = await supabase
    .from('business_listing_reviews')
    .select('id')
    .eq('id', reviewId)
    .maybeSingle();
  throwIfSupabaseError(reviewError, 'load reported business listing review');
  if (!review) {
    return {
      code: 'business_listing_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  await ensureUser(supabase, userId);
  const evidenceImageUrl = await uploadReportEvidence(
    supabase,
    userId,
    submission.evidenceImageDataUrl,
  );
  // Idempotent: a unique (business_listing_review_id, reporter_id)
  // constraint on business_listing_review_reports means a repeat report from
  // the same user is a silent no-op, not an error.
  const { error } = await supabase
    .from('business_listing_review_reports')
    .upsert(
      {
        business_listing_review_id: reviewId,
        details: submission.details,
        evidence_image_url: evidenceImageUrl,
        reason: submission.reason,
        reporter_id: userId,
      },
      { ignoreDuplicates: true, onConflict: 'business_listing_review_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report business listing review');
  return { ok: true, reported: true };
}

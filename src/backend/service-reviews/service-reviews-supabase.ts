import type { SupabaseClient } from '@supabase/supabase-js';

import { validateCommentBody } from '@/src/backend/comments';
import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type {
  CreateServiceReviewResult,
  ReportServiceReviewResult,
  ServiceReview,
  UpdateServiceReviewResult,
} from './types';

const SERVICE_REVIEW_SELECT =
  'id,listing_id,author_id,rating,body,created_at,author:app_users!service_reviews_author_id_fkey(id,name,avatar_url)';

interface ServiceReviewRow {
  readonly id: string;
  readonly listing_id: string;
  readonly author_id: string;
  readonly rating: number;
  readonly body: string;
  readonly created_at: string;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
  } | null;
}

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

const toServiceReview = (row: ServiceReviewRow): ServiceReview => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    name: row.author?.name ?? 'Member',
  },
  body: row.body,
  createdAt: row.created_at,
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
      { id: userId, name: 'Member' },
      { ignoreDuplicates: true, onConflict: 'id' },
    );
  throwIfSupabaseError(error, 'ensure service review user');
};

export async function listServiceReviewsSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<readonly ServiceReview[]> {
  const [{ data, error }, mutedUserIds] = await Promise.all([
    supabase
      .from('service_reviews')
      .select(SERVICE_REVIEW_SELECT)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false }),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load service reviews');
  const mutedSet = new Set(mutedUserIds);
  return (data as unknown as ServiceReviewRow[])
    .filter((row) => !mutedSet.has(row.author_id))
    .map(toServiceReview);
}

export async function createServiceReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  input: unknown,
): Promise<CreateServiceReviewResult> {
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
  const { data: listing, error: listingError } = await supabase
    .from('service_listings')
    .select('id')
    .eq('id', listingId)
    .maybeSingle();
  throwIfSupabaseError(listingError, 'load review listing');
  if (!listing) {
    return {
      code: 'service_listing_not_found',
      message: 'Listing not found.',
      ok: false,
    };
  }
  await ensureUser(supabase, userId);
  const { data, error } = await supabase
    .from('service_reviews')
    .insert({
      author_id: userId,
      body: bodyValidation.body,
      listing_id: listingId,
      rating,
    })
    .select(SERVICE_REVIEW_SELECT)
    .single();
  throwIfSupabaseError(error, 'create service review');
  if (!data) {
    throw new Error('create service review: database returned no review.');
  }
  return {
    ok: true,
    review: toServiceReview(data as unknown as ServiceReviewRow),
  };
}

export async function updateServiceReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  input: unknown,
): Promise<UpdateServiceReviewResult> {
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
  const { data, error } = await supabase
    .from('service_reviews')
    .update({ body: bodyValidation.body, rating })
    .eq('id', reviewId)
    .eq('author_id', userId)
    .select(SERVICE_REVIEW_SELECT)
    .maybeSingle();
  throwIfSupabaseError(error, 'update service review');
  if (!data) {
    return {
      code: 'service_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  return { ok: true, review: toServiceReview(data as unknown as ServiceReviewRow) };
}

export async function deleteServiceReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('service_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('author_id', userId)
    .select('id');
  throwIfSupabaseError(error, 'delete service review');
  return Array.isArray(data) && data.length > 0;
}

export async function reportServiceReviewSupabase(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
): Promise<ReportServiceReviewResult> {
  const { data: review, error: reviewError } = await supabase
    .from('service_reviews')
    .select('id')
    .eq('id', reviewId)
    .maybeSingle();
  throwIfSupabaseError(reviewError, 'load reported service review');
  if (!review) {
    return {
      code: 'service_review_not_found',
      message: 'Review not found.',
      ok: false,
    };
  }
  await ensureUser(supabase, userId);
  // Idempotent: a unique (service_review_id, reporter_id) constraint on
  // service_review_reports means a repeat report from the same user is a
  // silent no-op, not an error.
  const { error } = await supabase
    .from('service_review_reports')
    .upsert(
      { reporter_id: userId, service_review_id: reviewId },
      { ignoreDuplicates: true, onConflict: 'service_review_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report service review');
  return { ok: true, reported: true };
}

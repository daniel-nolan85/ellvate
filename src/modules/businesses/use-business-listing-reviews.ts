import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type { PersonRef } from './use-businesses';

export interface BusinessListingReview {
  readonly id: string;
  readonly listingId: string;
  readonly author: PersonRef;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

interface BusinessListingReviewsPageResponse {
  readonly reviews: readonly BusinessListingReview[];
  readonly nextCursor: string | null;
}

interface CreateBusinessListingReviewResponse {
  readonly review: BusinessListingReview;
}

export interface CreateBusinessListingReviewInput {
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string;
}

const queryMeta = { persist: true, sensitive: false } as const;
const BUSINESS_LISTING_REVIEWS_PAGE_SIZE = 20;
const businessListingReviewsPath = (listingId: string): `/${string}` =>
  `/api/business-listings/${listingId}/reviews`;
const businessListingReviewsPagePath = (
  listingId: string,
  cursor: string | null,
): `/${string}` =>
  `${businessListingReviewsPath(listingId)}?limit=${BUSINESS_LISTING_REVIEWS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

export function useBusinessListingReviews(listingId: string) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: BusinessListingReviewsPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<BusinessListingReviewsPageResponse>({
        getAccessToken: session.getToken,
        path: businessListingReviewsPagePath(listingId, pageParam),
        signal,
      }),
    queryKey: ['businesses', 'reviews', session.userId ?? 'demo-user', listingId],
  });
}

export function useCreateBusinessListingReview(listingId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (input: CreateBusinessListingReviewInput) =>
      requestJson<CreateBusinessListingReviewResponse>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: businessListingReviewsPath(listingId),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['businesses', 'reviews', userId, listingId],
      });
      // A new review shifts the listing's averageRating/reviewCount summary.
      void queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
}

export function useUpdateBusinessListingReview(listingId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({
      reviewId,
      ...input
    }: CreateBusinessListingReviewInput & { readonly reviewId: string }) =>
      requestJson<CreateBusinessListingReviewResponse>({
        body: input,
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/business-listing-reviews/${reviewId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['businesses', 'reviews', userId, listingId],
      });
      void queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
}

export function useDeleteBusinessListingReview(listingId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (reviewId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/business-listing-reviews/${reviewId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['businesses', 'reviews', userId, listingId],
      });
      void queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });
}

export function useReportBusinessListingReview() {
  const session = useSession();

  return useMutation({
    mutationFn: ({ reviewId, ...submission }: { reviewId: string } & ReportSubmission) =>
      requestJson<{ reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/business-listing-reviews/${reviewId}/report`,
      }),
  });
}

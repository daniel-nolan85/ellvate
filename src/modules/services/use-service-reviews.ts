import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type { PersonRef } from './use-services';

export interface ServiceReview {
  readonly id: string;
  readonly listingId: string;
  readonly author: PersonRef;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

interface ServiceReviewsPageResponse {
  readonly reviews: readonly ServiceReview[];
  readonly nextCursor: string | null;
}

interface CreateServiceReviewResponse {
  readonly review: ServiceReview;
}

export interface CreateServiceReviewInput {
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string;
}

const queryMeta = { persist: true, sensitive: false } as const;
const SERVICE_REVIEWS_PAGE_SIZE = 20;
const serviceReviewsPath = (listingId: string): `/${string}` =>
  `/api/services/${listingId}/reviews`;
const serviceReviewsPagePath = (
  listingId: string,
  cursor: string | null,
): `/${string}` =>
  `${serviceReviewsPath(listingId)}?limit=${SERVICE_REVIEWS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

export function useServiceReviews(listingId: string) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: ServiceReviewsPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<ServiceReviewsPageResponse>({
        getAccessToken: session.getToken,
        path: serviceReviewsPagePath(listingId, pageParam),
        signal,
      }),
    queryKey: ['services', 'reviews', session.userId ?? 'demo-user', listingId],
  });
}

export function useCreateServiceReview(listingId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (input: CreateServiceReviewInput) =>
      requestJson<CreateServiceReviewResponse>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: serviceReviewsPath(listingId),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['services', 'reviews', userId, listingId],
      });
      // A new review shifts the listing's averageRating/reviewCount summary.
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useUpdateServiceReview(listingId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({
      reviewId,
      ...input
    }: CreateServiceReviewInput & { readonly reviewId: string }) =>
      requestJson<CreateServiceReviewResponse>({
        body: input,
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/service-reviews/${reviewId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['services', 'reviews', userId, listingId],
      });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useDeleteServiceReview(listingId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (reviewId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/service-reviews/${reviewId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['services', 'reviews', userId, listingId],
      });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useReportServiceReview() {
  const session = useSession();

  return useMutation({
    mutationFn: ({ reviewId, ...submission }: { reviewId: string } & ReportSubmission) =>
      requestJson<{ reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/service-reviews/${reviewId}/report`,
      }),
  });
}

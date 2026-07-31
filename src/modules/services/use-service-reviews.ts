import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
}

interface ServiceReviewsResponse {
  readonly reviews: readonly ServiceReview[];
}

interface CreateServiceReviewResponse {
  readonly review: ServiceReview;
}

export interface CreateServiceReviewInput {
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string;
}

const queryMeta = { persist: true, sensitive: false } as const;
const serviceReviewsPath = (listingId: string): `/${string}` =>
  `/api/services/${listingId}/reviews`;

export function useServiceReviews(listingId: string) {
  const session = useSession();

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<ServiceReviewsResponse>({
        getAccessToken: session.getToken,
        path: serviceReviewsPath(listingId),
        signal,
      }),
    queryKey: ['services', 'reviews', session.userId ?? 'demo-user', listingId],
    select: (response) => response.reviews,
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
    mutationFn: (reviewId: string) =>
      requestJson<{ reported: boolean }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/service-reviews/${reviewId}/report`,
      }),
  });
}

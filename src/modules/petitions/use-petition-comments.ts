import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface PetitionComment {
  readonly id: string;
  readonly petitionId: string;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatarUrl: string | null;
    readonly isAdmin: boolean;
  };
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

interface PetitionCommentsPageResponse {
  readonly comments: readonly PetitionComment[];
  readonly nextCursor: string | null;
}

const queryMeta = { persist: true, sensitive: false } as const;
const PETITION_COMMENTS_PAGE_SIZE = 20;
const petitionCommentsPath = (petitionId: string): `/${string}` =>
  `/api/petitions/${petitionId}/comments`;
const petitionCommentsPagePath = (petitionId: string, cursor: string | null): `/${string}` =>
  `${petitionCommentsPath(petitionId)}?limit=${PETITION_COMMENTS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

// Oldest-first, bounded and cursor-paginated on the server, same as
// use-event-comments -- only meaningful once a petition has succeeded (the
// server rejects earlier posts, but reading an empty/nonexistent thread is
// harmless).
export function usePetitionComments(petitionId: string) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: PetitionCommentsPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<PetitionCommentsPageResponse>({
        getAccessToken: session.getToken,
        path: petitionCommentsPagePath(petitionId, pageParam),
        signal,
      }),
    queryKey: ['petitions', 'comments', session.userId ?? 'demo-user', petitionId],
  });
}

export function useCreatePetitionComment(petitionId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (body: string) =>
      requestJson<{ readonly comment: PetitionComment }>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'POST',
        path: petitionCommentsPath(petitionId),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['petitions', 'comments', userId, petitionId],
      });
    },
  });
}

export function useUpdatePetitionComment(petitionId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      requestJson<{ readonly comment: PetitionComment }>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/petition-comments/${commentId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['petitions', 'comments', userId, petitionId],
      });
    },
  });
}

export function useDeletePetitionComment(petitionId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (commentId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/petition-comments/${commentId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['petitions', 'comments', userId, petitionId],
      });
    },
  });
}

export function useReportPetitionComment() {
  const session = useSession();

  return useMutation({
    mutationFn: ({ commentId, ...submission }: { commentId: string } & ReportSubmission) =>
      requestJson<{ reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/petition-comments/${commentId}/report`,
      }),
  });
}

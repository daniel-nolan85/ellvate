import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import {
  parseMissionCommentsPageResponse,
  type MissionComment,
  type MissionCommentsPageResponse,
} from './mission-comment-contract';

export type { MissionComment } from './mission-comment-contract';

interface CreateMissionCommentResponse {
  readonly comment: MissionComment;
}

const queryMeta = { persist: true, sensitive: false } as const;
const MISSION_COMMENTS_PAGE_SIZE = 20;
const missionCommentsPath = (missionId: string): `/${string}` =>
  `/api/missions/${missionId}/comments`;
const missionCommentsPagePath = (
  missionId: string,
  cursor: string | null,
): `/${string}` =>
  `${missionCommentsPath(missionId)}?limit=${MISSION_COMMENTS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

// Bounded and cursor-paginated on the server, same as usePostComments --
// oldest-first, so scrolling down through the detail screen loads later
// comments.
export function useMissionComments(missionId: string) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: MissionCommentsPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<unknown>({
        getAccessToken: session.getToken,
        path: missionCommentsPagePath(missionId, pageParam),
        signal,
      }).then(parseMissionCommentsPageResponse),
    queryKey: ['missions', 'comments', session.userId ?? 'demo-user', missionId],
  });
}

export function useCreateMissionComment(missionId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (body: string) =>
      requestJson<CreateMissionCommentResponse>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'POST',
        path: missionCommentsPath(missionId),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['missions', 'comments', userId, missionId],
      });
    },
  });
}

export function useUpdateMissionComment(missionId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      requestJson<CreateMissionCommentResponse>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/mission-comments/${commentId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['missions', 'comments', userId, missionId],
      });
    },
  });
}

export function useDeleteMissionComment(missionId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (commentId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/mission-comments/${commentId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['missions', 'comments', userId, missionId],
      });
    },
  });
}

export function useReportMissionComment() {
  const session = useSession();

  return useMutation({
    mutationFn: (commentId: string) =>
      requestJson<{ reported: boolean }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/mission-comments/${commentId}/report`,
      }),
  });
}

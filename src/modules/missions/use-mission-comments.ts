import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import {
  parseMissionCommentsResponse,
  type MissionComment,
} from './mission-comment-contract';

export type { MissionComment } from './mission-comment-contract';

interface CreateMissionCommentResponse {
  readonly comment: MissionComment;
}

const queryMeta = { persist: true, sensitive: false } as const;
const missionCommentsPath = (missionId: string): `/${string}` =>
  `/api/missions/${missionId}/comments`;

export function useMissionComments(missionId: string) {
  const session = useSession();

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<unknown>({
        getAccessToken: session.getToken,
        path: missionCommentsPath(missionId),
        signal,
      }),
    queryKey: ['missions', 'comments', session.userId ?? 'demo-user', missionId],
    select: parseMissionCommentsResponse,
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

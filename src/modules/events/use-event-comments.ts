import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import {
  parseEventCommentsResponse,
  type EventComment,
} from './event-comment-contract';

export type { EventComment } from './event-comment-contract';

interface CreateEventCommentResponse {
  readonly comment: EventComment;
}

const queryMeta = { persist: true, sensitive: false } as const;
const eventCommentsPath = (eventId: string): `/${string}` =>
  `/api/events/${eventId}/comments`;

export function useEventComments(eventId: string) {
  const session = useSession();

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<unknown>({
        getAccessToken: session.getToken,
        path: eventCommentsPath(eventId),
        signal,
      }),
    queryKey: ['events', 'comments', session.userId ?? 'demo-user', eventId],
    select: parseEventCommentsResponse,
  });
}

export function useCreateEventComment(eventId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (body: string) =>
      requestJson<CreateEventCommentResponse>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'POST',
        path: eventCommentsPath(eventId),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['events', 'comments', userId, eventId],
      });
    },
  });
}

export function useDeleteEventComment(eventId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (commentId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/event-comments/${commentId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['events', 'comments', userId, eventId],
      });
    },
  });
}

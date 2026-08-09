import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import {
  parseEventCommentsPageResponse,
  type EventComment,
  type EventCommentsPageResponse,
} from './event-comment-contract';

export type { EventComment } from './event-comment-contract';

interface CreateEventCommentResponse {
  readonly comment: EventComment;
}

const queryMeta = { persist: true, sensitive: false } as const;
const EVENT_COMMENTS_PAGE_SIZE = 20;
const eventCommentsPath = (eventId: string): `/${string}` =>
  `/api/events/${eventId}/comments`;
const eventCommentsPagePath = (
  eventId: string,
  cursor: string | null,
): `/${string}` =>
  `${eventCommentsPath(eventId)}?limit=${EVENT_COMMENTS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

// Bounded and cursor-paginated on the server, same as usePostComments --
// oldest-first, so scrolling down through the detail screen loads later
// comments.
export function useEventComments(eventId: string) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: EventCommentsPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<unknown>({
        getAccessToken: session.getToken,
        path: eventCommentsPagePath(eventId, pageParam),
        signal,
      }).then(parseEventCommentsPageResponse),
    queryKey: ['events', 'comments', session.userId ?? 'demo-user', eventId],
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

export function useUpdateEventComment(eventId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      requestJson<CreateEventCommentResponse>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/event-comments/${commentId}`,
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

export function useReportEventComment() {
  const session = useSession();

  return useMutation({
    mutationFn: (commentId: string) =>
      requestJson<{ reported: boolean }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/event-comments/${commentId}/report`,
      }),
  });
}

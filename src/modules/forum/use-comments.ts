import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import {
  parseCommentsPageResponse,
  type CommentsPageResponse,
  type ForumComment,
} from './comment-contract';

export type { ForumComment } from './comment-contract';

interface CreateCommentResponse {
  readonly comment: ForumComment;
}

const queryMeta = { persist: true, sensitive: false } as const;
const COMMENTS_PAGE_SIZE = 20;
const commentsPath = (postId: string): `/${string}` =>
  `/api/forum/posts/${postId}/comments`;
const commentsPagePath = (postId: string, cursor: string | null): `/${string}` =>
  `${commentsPath(postId)}?limit=${COMMENTS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

// Bounded and cursor-paginated on the server rather than loading a post's
// entire comment thread in one shot -- callers that need a flat list should
// flatten `data.pages` themselves. Oldest-first, matching the thread's
// natural reading order, so scrolling down through the detail screen loads
// later comments, same direction as every other feed's auto-scroll.
export function usePostComments(postId: string) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: CommentsPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<unknown>({
        getAccessToken: session.getToken,
        path: commentsPagePath(postId, pageParam),
        signal,
      }).then(parseCommentsPageResponse),
    queryKey: ['forum', 'comments', session.userId ?? 'demo-user', postId],
  });
}

export function useCreateComment(postId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (body: string) =>
      requestJson<CreateCommentResponse>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'POST',
        path: commentsPath(postId),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'comments', userId, postId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'comments', 'mine', userId],
      });
      void queryClient.invalidateQueries({ queryKey: ['forum', 'posts', userId] });
    },
  });
}

export function useUpdateComment(postId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      requestJson<CreateCommentResponse>({
        body: { body },
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/comments/${commentId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'comments', userId, postId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'comments', 'mine', userId],
      });
    },
  });
}

export function useDeleteComment(postId: string) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (commentId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/comments/${commentId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'comments', userId, postId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'comments', 'mine', userId],
      });
      void queryClient.invalidateQueries({ queryKey: ['forum', 'posts', userId] });
    },
  });
}

export interface MyComment {
  readonly id: string;
  readonly postId: string;
  readonly postTitle: string;
  readonly body: string;
  readonly createdAt: string;
}

interface MyCommentsResponse {
  readonly comments: readonly MyComment[];
}

export function useMyComments() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<MyCommentsResponse>({
        getAccessToken: session.getToken,
        path: '/api/comments/mine',
        signal,
      }),
    queryKey: ['forum', 'comments', 'mine', userId],
    select: (data) => data.comments,
  });
}

export function useReportComment() {
  const session = useSession();

  return useMutation({
    mutationFn: (commentId: string) =>
      requestJson<{ reported: boolean }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/comments/${commentId}/report`,
      }),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface CommentAuthor {
  readonly id: string;
  readonly name: string;
}

export interface ForumComment {
  readonly id: string;
  readonly postId: string;
  readonly author: CommentAuthor;
  readonly body: string;
  readonly createdAt: string;
}

interface CommentsResponse {
  readonly comments: readonly ForumComment[];
}

interface CreateCommentResponse {
  readonly comment: ForumComment;
}

const queryMeta = { persist: true, sensitive: false } as const;
const commentsPath = (postId: string): `/${string}` =>
  `/api/forum/posts/${postId}/comments`;

export function usePostComments(postId: string) {
  const session = useSession();

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<CommentsResponse>({
        getAccessToken: session.getToken,
        path: commentsPath(postId),
        signal,
      }),
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
      void queryClient.invalidateQueries({ queryKey: ['forum', 'posts', userId] });
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
      void queryClient.invalidateQueries({ queryKey: ['forum', 'posts', userId] });
    },
  });
}

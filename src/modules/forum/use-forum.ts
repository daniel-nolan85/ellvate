import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface PersonRef {
  readonly id: string;
  readonly name: string;
}

export interface ForumPost {
  readonly id: string;
  readonly forum: string;
  readonly author: PersonRef;
  readonly createdAt: string;
  readonly title: string;
  readonly excerpt: string;
  readonly replies: number;
  readonly likes: number;
  readonly liked: boolean;
  readonly pinned: boolean;
}

export interface CreatePostInput {
  readonly forum: string;
  readonly title: string;
  readonly excerpt: string;
}

export interface UpdatePostInput {
  readonly postId: string;
  readonly title: string;
  readonly excerpt: string;
}

export interface ToggleLikeInput {
  readonly forum: string;
  readonly postId: string;
}

interface SubforumsResponse {
  readonly subforums: readonly string[];
}

interface PostsResponse {
  readonly posts: readonly ForumPost[];
}

interface ToggleLikeResponse {
  readonly id: string;
  readonly likes: number;
  readonly liked: boolean;
}

interface CreatePostResponse {
  readonly post: ForumPost;
}

const queryMeta = { persist: true, sensitive: false } as const;

const postsPath = (forum: string): `/${string}` =>
  forum === 'All'
    ? '/api/forum/posts'
    : `/api/forum/posts?forum=${encodeURIComponent(forum)}`;

export function useSubforums() {
  const session = useSession();

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<SubforumsResponse>({
        getAccessToken: session.getToken,
        path: '/api/forum/subforums',
        signal,
      }),
    queryKey: ['forum', 'subforums', session.userId ?? 'demo-user'],
  });
}

export function useForumPosts(forum: string) {
  const session = useSession();

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<PostsResponse>({
        getAccessToken: session.getToken,
        path: postsPath(forum),
        signal,
      }),
    queryKey: ['forum', 'posts', session.userId ?? 'demo-user', forum],
  });
}

export function useToggleLike() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({ postId }: ToggleLikeInput) =>
      requestJson<ToggleLikeResponse>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/forum/posts/${postId}/like`,
      }),
    onMutate: async ({ forum, postId }) => {
      const queryKey = ['forum', 'posts', userId, forum];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PostsResponse>(queryKey);
      queryClient.setQueryData<PostsResponse>(queryKey, (current) =>
        current === undefined
          ? current
          : {
              posts: current.posts.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      liked: !post.liked,
                      likes: post.likes + (post.liked ? -1 : 1),
                    }
                  : post,
              ),
            },
      );
      return { previous, queryKey };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'posts', userId],
      });
    },
  });
}

export function useCreatePost() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      requestJson<CreatePostResponse>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/forum/posts',
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'posts', userId],
      });
    },
  });
}

export function useUpdatePost() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: ({ excerpt, postId, title }: UpdatePostInput) =>
      requestJson<CreatePostResponse>({
        body: { excerpt, title },
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/forum/posts/${postId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'posts', userId],
      });
    },
  });
}

export function useDeletePost() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (postId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/forum/posts/${postId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'posts', userId],
      });
    },
  });
}

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface ForumPost {
  readonly id: string;
  readonly forum: string;
  readonly author: PersonRef;
  readonly createdAt: string;
  readonly title: string;
  readonly excerpt: string;
  readonly media?: readonly {
    readonly url: string;
    readonly filename: string;
  }[];
  readonly replies: number;
  readonly likes: number;
  readonly liked: boolean;
  readonly pinned: boolean;
}

export interface NewMediaInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface ExistingMediaInput {
  readonly filename: string;
  readonly url: string;
}

export interface CreatePostInput {
  readonly forum: string;
  readonly title: string;
  readonly excerpt: string;
  readonly newMedia?: readonly NewMediaInput[];
}

export interface UpdatePostInput {
  readonly postId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly forum?: string;
  readonly existingMedia?: readonly ExistingMediaInput[];
  readonly newMedia?: readonly NewMediaInput[];
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

export interface MyPostsPage {
  readonly posts: readonly ForumPost[];
  readonly nextCursor: string | null;
}

const MY_POSTS_PAGE_SIZE = 20;

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

// The activity hub — posts the caller authored, server-scoped and paginated
// rather than filtered client-side from the full forum feed. Shares the
// ['forum','posts',userId,...] key prefix so the existing post mutations'
// broad invalidation keeps this in sync too.
export function useMyPosts() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: MyPostsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<MyPostsPage>({
        getAccessToken: session.getToken,
        path: `/api/forum/posts/mine?limit=${MY_POSTS_PAGE_SIZE}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        signal,
      }),
    queryKey: ['forum', 'posts', userId, 'mine'],
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

interface TogglePinResponse {
  readonly id: string;
  readonly pinned: boolean;
}

// No optimistic update here, unlike useToggleLike — pinning changes sort
// order (pinned posts float to the top), so a client-side patch would need
// to re-sort the whole list too; simpler and still snappy enough to just
// invalidate and let the server's already-correct order come back.
export function useTogglePin() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (postId: string) =>
      requestJson<TogglePinResponse>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/forum/posts/${postId}/pin`,
      }),
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
    mutationFn: ({
      excerpt,
      existingMedia,
      forum,
      newMedia,
      postId,
      title,
    }: UpdatePostInput) =>
      requestJson<CreatePostResponse>({
        body: { excerpt, existingMedia, forum, newMedia, title },
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

export function useReportPost() {
  const session = useSession();

  return useMutation({
    mutationFn: (postId: string) =>
      requestJson<{ reported: boolean }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/forum/posts/${postId}/report`,
      }),
  });
}

export function useMuteUser() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (mutedUserId: string) =>
      requestJson<{ muted: boolean; mutedUserId: string }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/users/${mutedUserId}/mute`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['forum', 'posts', userId],
      });
      // Mute is a global visibility rule, not forum-scoped — also hide the
      // muted neighbour's service reviews.
      void queryClient.invalidateQueries({ queryKey: ['services', 'reviews'] });
    },
  });
}

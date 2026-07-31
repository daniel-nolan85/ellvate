import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { CommunityEvent } from '@/src/modules/events';
import type { ForumPost } from '@/src/modules/forum';
import type { Mission } from '@/src/modules/missions';
import type { ServiceListing } from '@/src/modules/services';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type BookmarkTargetType = 'post' | 'event' | 'mission' | 'service';

export type BookmarkedItem =
  | {
      readonly kind: 'post';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly post: ForumPost;
    }
  | {
      readonly kind: 'event';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly event: CommunityEvent;
    }
  | {
      readonly kind: 'mission';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly mission: Mission;
    }
  | {
      readonly kind: 'service';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly listing: ServiceListing;
    };

export interface BookmarksPage {
  readonly items: readonly BookmarkedItem[];
  readonly nextCursor: string | null;
}

interface BookmarkIdEntry {
  readonly targetType: BookmarkTargetType;
  readonly targetId: string;
}

interface BookmarkIdsResponse {
  readonly ids: readonly BookmarkIdEntry[];
}

const BOOKMARKS_PAGE_SIZE = 20;
const bookmarkKey = (targetType: BookmarkTargetType, targetId: string): string =>
  `${targetType}:${targetId}`;

const bookmarkIdsQueryKey = (userId: string) => ['bookmarks', 'ids', userId] as const;
const bookmarksListQueryKey = (
  userId: string,
  targetType: BookmarkTargetType | 'all',
) => ['bookmarks', 'list', userId, targetType] as const;

// The shared lookup set behind every card's bookmark icon — one request per
// screen rather than one per card. `useIsBookmarked` reads from this cached
// set instead of firing its own query.
export function useBookmarkIds() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<BookmarkIdsResponse>({
        getAccessToken: session.getToken,
        path: '/api/bookmarks/ids',
        signal,
      }),
    queryKey: bookmarkIdsQueryKey(userId),
    select: (data) => new Set(data.ids.map((entry) => bookmarkKey(entry.targetType, entry.targetId))),
  });
}

export function useIsBookmarked(
  targetType: BookmarkTargetType,
  targetId: string,
): boolean {
  const bookmarkIds = useBookmarkIds();
  return bookmarkIds.data?.has(bookmarkKey(targetType, targetId)) ?? false;
}

export function useToggleBookmark() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';
  const idsKey = bookmarkIdsQueryKey(userId);

  return useMutation({
    mutationFn: ({
      targetId,
      targetType,
    }: {
      readonly targetType: BookmarkTargetType;
      readonly targetId: string;
    }) =>
      requestJson<{ readonly bookmarked: boolean }>({
        body: { targetId, targetType },
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/bookmarks/toggle',
      }),
    onMutate: async ({ targetId, targetType }) => {
      await queryClient.cancelQueries({ queryKey: idsKey });
      const previous = queryClient.getQueryData<BookmarkIdsResponse>(idsKey);
      const key = bookmarkKey(targetType, targetId);
      const wasBookmarked = previous?.ids.some(
        (entry) => bookmarkKey(entry.targetType, entry.targetId) === key,
      );

      queryClient.setQueryData<BookmarkIdsResponse>(idsKey, (current) =>
        current === undefined
          ? current
          : {
              ids: wasBookmarked
                ? current.ids.filter(
                    (entry) => bookmarkKey(entry.targetType, entry.targetId) !== key,
                  )
                : [...current.ids, { targetId, targetType }],
            },
      );

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(idsKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: idsKey });
      void queryClient.invalidateQueries({ queryKey: ['bookmarks', 'list', userId] });
    },
  });
}

// The bookmarks screen — paginated, optionally filtered to one target type.
export function useBookmarks(targetType?: BookmarkTargetType) {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: BookmarksPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<BookmarksPage>({
        getAccessToken: session.getToken,
        path: `/api/bookmarks?limit=${BOOKMARKS_PAGE_SIZE}${
          targetType ? `&targetType=${targetType}` : ''
        }${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
        signal,
      }),
    queryKey: bookmarksListQueryKey(userId, targetType ?? 'all'),
  });
}

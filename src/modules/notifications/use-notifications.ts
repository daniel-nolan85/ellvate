import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface Notification {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationsPage {
  readonly notifications: readonly Notification[];
  readonly nextCursor: string | null;
}

export { resolveNotificationRoute } from './resolve-notification-route';

const PAGE_SIZE = 20;
const queryMeta = { persist: true, sensitive: false } as const;

const notificationsQueryKey = (userId: string) => ['notifications', userId] as const;
const unreadCountQueryKey = (userId: string) =>
  ['notifications', 'unread-count', userId] as const;

// The inbox screen — paginated, appends pages rather than re-downloading the
// caller's entire notification history on every mount/refetch.
export function useNotifications() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: NotificationsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<NotificationsPage>({
        getAccessToken: session.getToken,
        path: `/api/notifications?limit=${PAGE_SIZE}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        signal,
      }),
    queryKey: notificationsQueryKey(userId),
  });
}

// The persistent bell badge — a single bounded count, not the full list, so
// it stays cheap to poll from every screen title.
export function useUnreadNotificationsCount() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<{ count: number }>({
        getAccessToken: session.getToken,
        path: '/api/notifications/unread-count',
        signal,
      }),
    refetchInterval: 60_000,
    queryKey: unreadCountQueryKey(userId),
  });
}

export function useMarkNotificationRead() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: (notificationId: string) =>
      requestJson<{ id: string; read: boolean }>({
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/notifications/${notificationId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
      void queryClient.invalidateQueries({ queryKey: unreadCountQueryKey(userId) });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation({
    mutationFn: () =>
      requestJson<{ count: number }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/notifications/read-all',
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
      void queryClient.invalidateQueries({ queryKey: unreadCountQueryKey(userId) });
    },
  });
}

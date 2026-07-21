import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

interface NotificationsResponse {
  readonly notifications: readonly Notification[];
}

const queryMeta = { persist: true, sensitive: false } as const;

export function useNotifications() {
  const session = useSession();

  return useQuery({
    meta: queryMeta,
    queryFn: ({ signal }) =>
      requestJson<NotificationsResponse>({
        getAccessToken: session.getToken,
        path: '/api/notifications',
        signal,
      }),
    // WHY: the bell badge is visible on every tab screen, so refetch
    // periodically to keep the unread count reasonably fresh without
    // requiring a dedicated push-driven cache invalidation path yet.
    refetchInterval: 60_000,
    queryKey: ['notifications', session.userId ?? 'demo-user'],
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
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
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
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });
}

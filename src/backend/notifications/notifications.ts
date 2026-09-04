import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  setState,
  type NotificationPrefs,
  type StoredNotification,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  countUnreadNotificationsSupabase,
  listNotificationsSupabase,
  markAllNotificationsReadSupabase,
  markNotificationReadSupabase,
} from './notifications-supabase';
import type {
  ListNotificationsOptions,
  Notification,
  NotificationsPage,
} from './types';

export const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20;
export const MAX_NOTIFICATIONS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const toNotification = (stored: StoredNotification): Notification => ({
  body: stored.body,
  createdAt: stored.createdAt,
  data: stored.data,
  id: stored.id,
  kind: stored.kind,
  readAt: stored.readAt,
  title: stored.title,
});

// Mirrors the Supabase-side notif_replies/notif_events/notif_missions gate
// (see migration 0026) — 'like' shares 'replies' bucket by design, there is
// no dedicated likes preference.
const NOTIFICATION_PREF_BY_KIND: Readonly<Record<string, keyof NotificationPrefs>> = {
  comment: 'replies',
  event: 'events',
  like: 'replies',
  mission: 'missions',
  petition: 'petitions',
};

// WHY: called directly by other memory-mode modules (comments, event-comments)
// when a post/event author receives a reply — mirrors the Supabase
// `notify_post_author`/`notify_event_author` triggers, which fire
// automatically on insert and need no application-level call in that mode.
export function createNotificationMemory(
  userId: string,
  kind: string,
  title: string,
  body: string,
  data: Readonly<Record<string, unknown>>,
): void {
  const prefKey = NOTIFICATION_PREF_BY_KIND[kind];
  if (prefKey) {
    const recipient = getState().users.find((user) => user.id === userId);
    if (recipient && !recipient.profile.notificationPrefs[prefKey]) {
      return;
    }
  }
  setState((current) => ({
    ...current,
    notifications: [
      ...current.notifications,
      {
        body,
        createdAt: new Date().toISOString(),
        data,
        id: `notification-${crypto.randomUUID()}`,
        kind,
        readAt: null,
        title,
        userId,
      },
    ],
  }));
}

function listNotificationsMemory(
  userId: string,
  limit: number,
  cursor: string | null,
): NotificationsPage {
  const mine = getState().notifications.filter(
    (notification) => notification.userId === userId,
  );
  const wrapped = mine.map((notification) => ({
    id: notification.id,
    notification,
    sortKey: notification.createdAt,
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    nextCursor: page.nextCursor,
    notifications: page.items.map((item) => toNotification(item.notification)),
  };
}

function countUnreadNotificationsMemory(userId: string): number {
  return getState().notifications.filter(
    (notification) => notification.userId === userId && notification.readAt === null,
  ).length;
}

function markNotificationReadMemory(
  userId: string,
  notificationId: string,
): boolean {
  const existing = getState().notifications.find(
    (notification) =>
      notification.id === notificationId && notification.userId === userId,
  );
  if (!existing) {
    return false;
  }
  const nowIso = new Date().toISOString();
  setState((current) => ({
    ...current,
    notifications: current.notifications.map((notification) =>
      notification.id === notificationId
        ? { ...notification, readAt: notification.readAt ?? nowIso }
        : notification,
    ),
  }));
  return true;
}

function markAllNotificationsReadMemory(userId: string): number {
  const unread = getState().notifications.filter(
    (notification) => notification.userId === userId && notification.readAt === null,
  );
  if (unread.length === 0) {
    return 0;
  }
  const nowIso = new Date().toISOString();
  setState((current) => ({
    ...current,
    notifications: current.notifications.map((notification) =>
      notification.userId === userId && notification.readAt === null
        ? { ...notification, readAt: nowIso }
        : notification,
    ),
  }));
  return unread.length;
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function listNotifications(
  ctx: RequestContext,
  options?: ListNotificationsOptions,
): Promise<NotificationsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_NOTIFICATIONS_PAGE_SIZE),
    MAX_NOTIFICATIONS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listNotificationsSupabase(ctx.supabase, ctx.userId, limit, cursor)
    : listNotificationsMemory(ctx.userId, limit, cursor);
}

export async function countUnreadNotifications(
  ctx: RequestContext,
): Promise<number> {
  return ctx.supabase
    ? countUnreadNotificationsSupabase(ctx.supabase, ctx.userId)
    : countUnreadNotificationsMemory(ctx.userId);
}

export async function markNotificationRead(
  ctx: RequestContext,
  notificationId: string,
): Promise<boolean> {
  return ctx.supabase
    ? markNotificationReadSupabase(ctx.supabase, ctx.userId, notificationId)
    : markNotificationReadMemory(ctx.userId, notificationId);
}

export async function markAllNotificationsRead(
  ctx: RequestContext,
): Promise<number> {
  return ctx.supabase
    ? markAllNotificationsReadSupabase(ctx.supabase, ctx.userId)
    : markAllNotificationsReadMemory(ctx.userId);
}

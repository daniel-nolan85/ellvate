import type { RequestContext } from '@/src/backend/http';
import { getState, setState, type StoredNotification } from '@/src/backend/store';

import {
  listNotificationsSupabase,
  markAllNotificationsReadSupabase,
  markNotificationReadSupabase,
} from './notifications-supabase';
import type { Notification } from './types';

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

function listNotificationsMemory(userId: string): readonly Notification[] {
  return getState()
    .notifications.filter((notification) => notification.userId === userId)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(toNotification);
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
): Promise<readonly Notification[]> {
  return ctx.supabase
    ? listNotificationsSupabase(ctx.supabase, ctx.userId)
    : listNotificationsMemory(ctx.userId);
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

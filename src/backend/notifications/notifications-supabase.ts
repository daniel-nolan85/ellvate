import type { SupabaseClient } from '@supabase/supabase-js';

import { decodeCursor, encodeCursor } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { Notification, NotificationsPage } from './types';

const NOTIFICATION_SELECT = 'id,kind,title,body,data,read_at,created_at';

interface NotificationRow {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>> | null;
  readonly read_at: string | null;
  readonly created_at: string;
}

const toNotification = (row: NotificationRow): Notification => ({
  body: row.body,
  createdAt: row.created_at,
  data: row.data ?? {},
  id: row.id,
  kind: row.kind,
  readAt: row.read_at,
  title: row.title,
});

export async function listNotificationsSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
): Promise<NotificationsPage> {
  let query = supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // One extra row so we know whether a next page exists without a second
    // round trip.
    .limit(limit + 1);

  const parsedCursor = cursor ? decodeCursor(cursor) : null;
  if (parsedCursor) {
    query = query.or(
      `created_at.lt.${parsedCursor.sortKey},and(created_at.eq.${parsedCursor.sortKey},id.lt.${parsedCursor.id})`,
    );
  }

  const { data, error } = await query;
  throwIfSupabaseError(error, 'load notifications');
  const rows = data as unknown as NotificationRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ id: last.id, sortKey: last.created_at }) : null;

  return { notifications: page.map(toNotification), nextCursor };
}

export async function countUnreadNotificationsSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  throwIfSupabaseError(error, 'count unread notifications');
  return count ?? 0;
}

export async function markNotificationReadSupabase(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id');
  throwIfSupabaseError(error, 'mark notification read');
  return Array.isArray(data) && data.length > 0;
}

export async function markAllNotificationsReadSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');
  throwIfSupabaseError(error, 'mark all notifications read');
  return Array.isArray(data) ? data.length : 0;
}

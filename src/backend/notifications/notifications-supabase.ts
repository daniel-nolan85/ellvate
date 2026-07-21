import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { Notification } from './types';

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
): Promise<readonly Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  throwIfSupabaseError(error, 'load notifications');
  return (data as unknown as NotificationRow[]).map(toNotification);
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

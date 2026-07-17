import type { SupabaseClient } from '@supabase/supabase-js';

import { validateCommentBody } from '@/src/backend/comments';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { CreateEventCommentResult, EventComment } from './types';

const EVENT_COMMENT_SELECT =
  'id,event_id,author_id,body,created_at,author:app_users!event_comments_author_id_fkey(id,name,avatar_url)';

interface EventCommentRow {
  readonly id: string;
  readonly event_id: string;
  readonly author_id: string;
  readonly body: string;
  readonly created_at: string;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
  } | null;
}

const toEventComment = (row: EventCommentRow): EventComment => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    name: row.author?.name ?? 'Member',
  },
  body: row.body,
  createdAt: row.created_at,
  eventId: row.event_id,
  id: row.id,
});

const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert(
      { id: userId, name: 'Member' },
      { ignoreDuplicates: true, onConflict: 'id' },
    );
  throwIfSupabaseError(error, 'ensure event comment user');
};

export async function listEventCommentsSupabase(
  supabase: SupabaseClient,
  eventId: string,
): Promise<readonly EventComment[]> {
  const { data, error } = await supabase
    .from('event_comments')
    .select(EVENT_COMMENT_SELECT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'load event comments');
  return (data as unknown as EventCommentRow[]).map(toEventComment);
}

export async function createEventCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  input: unknown,
): Promise<CreateEventCommentResult> {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();
  throwIfSupabaseError(eventError, 'load comment event');
  if (!event) {
    return { code: 'event_not_found', message: 'Event not found.', ok: false };
  }
  await ensureUser(supabase, userId);
  const { data, error } = await supabase
    .from('event_comments')
    .insert({ author_id: userId, body: validation.body, event_id: eventId })
    .select(EVENT_COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'create event comment');
  if (!data) {
    throw new Error('create event comment: database returned no comment.');
  }
  return { comment: toEventComment(data as unknown as EventCommentRow), ok: true };
}

export async function deleteEventCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id');
  throwIfSupabaseError(error, 'delete event comment');
  return Array.isArray(data) && data.length > 0;
}

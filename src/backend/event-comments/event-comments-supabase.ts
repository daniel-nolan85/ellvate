import type { SupabaseClient } from '@supabase/supabase-js';

import { validateCommentBody } from '@/src/backend/comments';
import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type {
  CreateEventCommentResult,
  EventComment,
  EventCommentsPage,
  ReportEventCommentResult,
  UpdateEventCommentResult,
} from './types';

const EVENT_COMMENT_SELECT =
  'id,event_id,author_id,body,created_at,edited_at,author:app_users!event_comments_author_id_fkey(id,name,avatar_url)';

interface EventCommentRow {
  readonly id: string;
  readonly event_id: string;
  readonly author_id: string;
  readonly body: string;
  readonly created_at: string;
  readonly edited_at: string | null;
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
  editedAt: row.edited_at,
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

// The paginated counterpart to listEventCommentsSupabase (see forum
// comments' listCommentsPageSupabase for the full rationale).
const MAX_EVENT_COMMENT_TIMESTAMP = 9_999_999_999_999;

export async function listEventCommentsPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  limit: number,
  cursor: string | null,
): Promise<EventCommentsPage> {
  const [{ data, error }, mutedUserIds] = await Promise.all([
    supabase
      .from('event_comments')
      .select(EVENT_COMMENT_SELECT)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load event comments');
  const mutedSet = new Set(mutedUserIds);
  const rows = ((data as unknown as EventCommentRow[]) ?? []).filter(
    (row) => !mutedSet.has(row.author_id),
  );

  const wrapped = rows.map((row) => ({
    id: row.id,
    row,
    sortKey: String(
      MAX_EVENT_COMMENT_TIMESTAMP - Date.parse(row.created_at),
    ).padStart(13, '0'),
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    comments: page.items.map((item) => toEventComment(item.row)),
    nextCursor: page.nextCursor,
  };
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

export async function updateEventCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
  input: unknown,
): Promise<UpdateEventCommentResult> {
  const { data: existing, error: existingError } = await supabase
    .from('event_comments')
    .select('id,author_id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load event comment for update');
  if (!existing) {
    return {
      code: 'event_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }
  if (existing.author_id !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own comments.',
      ok: false,
    };
  }
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const { data, error } = await supabase
    .from('event_comments')
    .update({ body: validation.body, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select(EVENT_COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'update event comment');
  if (!data) {
    throw new Error('update event comment: database returned no comment.');
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

export async function reportEventCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<ReportEventCommentResult> {
  const { data: comment, error: commentError } = await supabase
    .from('event_comments')
    .select('id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(commentError, 'load reported event comment');
  if (!comment) {
    return {
      code: 'event_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }

  await ensureUser(supabase, userId);
  // Idempotent: a unique (event_comment_id, reporter_id) constraint on
  // event_comment_reports means a repeat report from the same user is a
  // silent no-op, not an error.
  const { error } = await supabase
    .from('event_comment_reports')
    .upsert(
      { event_comment_id: commentId, reporter_id: userId },
      { ignoreDuplicates: true, onConflict: 'event_comment_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report event comment');
  return { ok: true, reported: true };
}

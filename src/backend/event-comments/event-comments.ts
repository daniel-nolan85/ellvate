import { validateCommentBody } from '@/src/backend/comments';
import type { RequestContext } from '@/src/backend/http';
import { createNotificationMemory } from '@/src/backend/notifications';
import {
  getState,
  setState,
  type StoredEventComment,
  type StoredUser,
} from '@/src/backend/store';

import {
  createEventCommentSupabase,
  deleteEventCommentSupabase,
  listEventCommentsSupabase,
  reportEventCommentSupabase,
} from './event-comments-supabase';
import type {
  CreateEventCommentResult,
  EventComment,
  PersonRef,
  ReportEventCommentResult,
} from './types';

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id, name: 'Member' };
};

const toEventComment = (
  stored: StoredEventComment,
  users: readonly StoredUser[],
): EventComment => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
  eventId: stored.eventId,
  id: stored.id,
});

function listEventCommentsMemory(eventId: string): readonly EventComment[] {
  const state = getState();
  return state.eventComments
    .filter((comment) => comment.eventId === eventId)
    .slice()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((comment) => toEventComment(comment, state.users));
}

function createEventCommentMemory(
  userId: string,
  eventId: string,
  input: unknown,
): CreateEventCommentResult {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const event = getState().events.find((candidate) => candidate.id === eventId);
  if (!event) {
    return { code: 'event_not_found', message: 'Event not found.', ok: false };
  }
  const stored: StoredEventComment = {
    authorId: userId,
    body: validation.body,
    createdAt: new Date().toISOString(),
    eventId,
    id: `event-comment-${crypto.randomUUID()}`,
  };
  const next = setState((current) => ({
    ...current,
    eventComments: [...current.eventComments, stored],
  }));
  // WHY: mirrors the Supabase `notify_event_author` trigger — skip notifying
  // yourself when you comment on your own event. Uses kind 'event' so it maps
  // to the same `notif_events` preference the push-delivery trigger checks.
  if (event.authorId !== userId) {
    const commenter = next.users.find((candidate) => candidate.id === userId);
    createNotificationMemory(
      event.authorId,
      'event',
      'New comment on your event',
      `${commenter?.name ?? 'Someone'} commented on "${event.title}"`,
      { commentId: stored.id, eventId },
    );
  }
  return { comment: toEventComment(stored, next.users), ok: true };
}

function deleteEventCommentMemory(userId: string, commentId: string): boolean {
  const existing = getState().eventComments.find(
    (comment) => comment.id === commentId && comment.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    eventCommentReports: current.eventCommentReports.filter(
      (report) => report.eventCommentId !== commentId,
    ),
    eventComments: current.eventComments.filter(
      (comment) => comment.id !== commentId,
    ),
  }));
  return true;
}

function reportEventCommentMemory(
  userId: string,
  commentId: string,
): ReportEventCommentResult {
  if (!getState().eventComments.some((comment) => comment.id === commentId)) {
    return {
      code: 'event_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().eventCommentReports.some(
    (report) =>
      report.eventCommentId === commentId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      eventCommentReports: [
        ...current.eventCommentReports,
        {
          createdAt: new Date().toISOString(),
          eventCommentId: commentId,
          id: `event-comment-report-${crypto.randomUUID()}`,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function listEventComments(
  ctx: RequestContext,
  eventId: string,
): Promise<readonly EventComment[]> {
  return ctx.supabase
    ? listEventCommentsSupabase(ctx.supabase, eventId)
    : listEventCommentsMemory(eventId);
}

export async function createEventComment(
  ctx: RequestContext,
  eventId: string,
  input: unknown,
): Promise<CreateEventCommentResult> {
  return ctx.supabase
    ? createEventCommentSupabase(ctx.supabase, ctx.userId, eventId, input)
    : createEventCommentMemory(ctx.userId, eventId, input);
}

export async function deleteEventComment(
  ctx: RequestContext,
  commentId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteEventCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : deleteEventCommentMemory(ctx.userId, commentId);
}

export async function reportEventComment(
  ctx: RequestContext,
  commentId: string,
): Promise<ReportEventCommentResult> {
  return ctx.supabase
    ? reportEventCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : reportEventCommentMemory(ctx.userId, commentId);
}

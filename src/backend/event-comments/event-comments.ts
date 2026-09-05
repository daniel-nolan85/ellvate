import { validateCommentBody } from '@/src/backend/comments';
import type { RequestContext } from '@/src/backend/http';
import { createNotificationMemory } from '@/src/backend/notifications';
import {
  getState,
  setState,
  type StoredEventComment,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import type { ValidReportSubmission } from '../reports/report-submission';
import {
  createEventCommentSupabase,
  deleteEventCommentSupabase,
  listEventCommentsPageSupabase,
  listEventCommentsSupabase,
  reportEventCommentSupabase,
  updateEventCommentSupabase,
} from './event-comments-supabase';
import type {
  CreateEventCommentResult,
  EventComment,
  EventCommentsPage,
  PersonRef,
  ReportEventCommentResult,
  UpdateEventCommentResult,
} from './types';

export const DEFAULT_EVENT_COMMENTS_PAGE_SIZE = 20;
export const MAX_EVENT_COMMENTS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, isAdmin: user.isAdmin, name: user.name }
    : { avatarUrl: null, id, isAdmin: false, name: 'Member' };
};

const toEventComment = (
  stored: StoredEventComment,
  users: readonly StoredUser[],
): EventComment => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
  editedAt: stored.editedAt,
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

// The paginated counterpart to listEventCommentsMemory (see forum comments'
// listCommentsPageMemory for the full rationale -- same pattern, mirrored).
const MAX_EVENT_COMMENT_TIMESTAMP = 9_999_999_999_999;

function listEventCommentsPageMemory(
  userId: string,
  eventId: string,
  limit: number,
  cursor: string | null,
): EventCommentsPage {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const filtered = state.eventComments
    .filter((comment) => comment.eventId === eventId)
    .filter((comment) => !mutedUserIds.has(comment.authorId))
    .map((comment) => ({
      comment,
      id: comment.id,
      sortKey: String(
        MAX_EVENT_COMMENT_TIMESTAMP - Date.parse(comment.createdAt),
      ).padStart(13, '0'),
    }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    comments: page.items.map((item) => toEventComment(item.comment, state.users)),
    nextCursor: page.nextCursor,
  };
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
    editedAt: null,
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

function updateEventCommentMemory(
  userId: string,
  commentId: string,
  input: unknown,
): UpdateEventCommentResult {
  const existing = getState().eventComments.find(
    (comment) => comment.id === commentId,
  );
  if (!existing) {
    return {
      code: 'event_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }
  if (existing.authorId !== userId) {
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
  const editedAt = new Date().toISOString();
  const next = setState((current) => ({
    ...current,
    eventComments: current.eventComments.map((comment) =>
      comment.id === commentId
        ? { ...comment, body: validation.body, editedAt }
        : comment,
    ),
  }));
  const updated = next.eventComments.find((comment) => comment.id === commentId);
  if (!updated) {
    throw new Error('update event comment: comment vanished after update.');
  }
  return { comment: toEventComment(updated, next.users), ok: true };
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
  submission: ValidReportSubmission,
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
          details: submission.details,
          eventCommentId: commentId,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `event-comment-report-${crypto.randomUUID()}`,
          reason: submission.reason,
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

// The paginated, public-facing counterpart to listEventComments.
export async function listEventCommentsPage(
  ctx: RequestContext,
  eventId: string,
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<EventCommentsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_EVENT_COMMENTS_PAGE_SIZE),
    MAX_EVENT_COMMENTS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listEventCommentsPageSupabase(ctx.supabase, ctx.userId, eventId, limit, cursor)
    : listEventCommentsPageMemory(ctx.userId, eventId, limit, cursor);
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

export async function updateEventComment(
  ctx: RequestContext,
  commentId: string,
  input: unknown,
): Promise<UpdateEventCommentResult> {
  return ctx.supabase
    ? updateEventCommentSupabase(ctx.supabase, ctx.userId, commentId, input)
    : updateEventCommentMemory(ctx.userId, commentId, input);
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
  submission: ValidReportSubmission,
): Promise<ReportEventCommentResult> {
  return ctx.supabase
    ? reportEventCommentSupabase(ctx.supabase, ctx.userId, commentId, submission)
    : reportEventCommentMemory(ctx.userId, commentId, submission);
}

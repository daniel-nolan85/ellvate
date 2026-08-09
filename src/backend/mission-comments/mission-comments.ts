import { validateCommentBody } from '@/src/backend/comments';
import type { RequestContext } from '@/src/backend/http';
import { createNotificationMemory } from '@/src/backend/notifications';
import {
  getState,
  setState,
  type StoredMissionComment,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  createMissionCommentSupabase,
  deleteMissionCommentSupabase,
  listMissionCommentsPageSupabase,
  listMissionCommentsSupabase,
  reportMissionCommentSupabase,
  updateMissionCommentSupabase,
} from './mission-comments-supabase';
import type {
  CreateMissionCommentResult,
  MissionComment,
  MissionCommentsPage,
  PersonRef,
  ReportMissionCommentResult,
  UpdateMissionCommentResult,
} from './types';

export const DEFAULT_MISSION_COMMENTS_PAGE_SIZE = 20;
export const MAX_MISSION_COMMENTS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id, name: 'Member' };
};

const toMissionComment = (
  stored: StoredMissionComment,
  users: readonly StoredUser[],
): MissionComment => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
  editedAt: stored.editedAt,
  id: stored.id,
  missionId: stored.missionId,
});

function listMissionCommentsMemory(missionId: string): readonly MissionComment[] {
  const state = getState();
  return state.missionComments
    .filter((comment) => comment.missionId === missionId)
    .slice()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((comment) => toMissionComment(comment, state.users));
}

// The paginated counterpart to listMissionCommentsMemory (used by the public
// thread view; listMissionCommentsMemory itself stays unbounded). Oldest-
// first, matching the thread's natural reading order -- paginateInMemory
// always sorts descending by sortKey, so the sortKey inverts the timestamp
// to preserve that ascending order (same trick used for forum/event
// comments).
const MAX_MISSION_COMMENT_TIMESTAMP = 9_999_999_999_999;

function listMissionCommentsPageMemory(
  missionId: string,
  limit: number,
  cursor: string | null,
): MissionCommentsPage {
  const state = getState();
  const filtered = state.missionComments
    .filter((comment) => comment.missionId === missionId)
    .map((comment) => ({
      comment,
      id: comment.id,
      sortKey: String(
        MAX_MISSION_COMMENT_TIMESTAMP - Date.parse(comment.createdAt),
      ).padStart(13, '0'),
    }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    comments: page.items.map((item) => toMissionComment(item.comment, state.users)),
    nextCursor: page.nextCursor,
  };
}

function createMissionCommentMemory(
  userId: string,
  missionId: string,
  input: unknown,
): CreateMissionCommentResult {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const mission = getState().missions.find(
    (candidate) => candidate.id === missionId,
  );
  if (!mission) {
    return { code: 'mission_not_found', message: 'Mission not found.', ok: false };
  }
  const stored: StoredMissionComment = {
    authorId: userId,
    body: validation.body,
    createdAt: new Date().toISOString(),
    editedAt: null,
    id: `mission-comment-${crypto.randomUUID()}`,
    missionId,
  };
  const next = setState((current) => ({
    ...current,
    missionComments: [...current.missionComments, stored],
  }));
  // WHY: mirrors the Supabase `notify_mission_author` trigger — skip
  // notifying yourself when you comment on your own mission. Uses kind
  // 'mission' so it maps to the same `notif_missions` preference the
  // push-delivery trigger checks.
  if (mission.authorId !== userId) {
    const commenter = next.users.find((candidate) => candidate.id === userId);
    createNotificationMemory(
      mission.authorId,
      'mission',
      'New comment on your mission',
      `${commenter?.name ?? 'Someone'} commented on "${mission.title}"`,
      { commentId: stored.id, missionId },
    );
  }
  return { comment: toMissionComment(stored, next.users), ok: true };
}

function updateMissionCommentMemory(
  userId: string,
  commentId: string,
  input: unknown,
): UpdateMissionCommentResult {
  const existing = getState().missionComments.find(
    (comment) => comment.id === commentId,
  );
  if (!existing) {
    return {
      code: 'mission_comment_not_found',
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
    missionComments: current.missionComments.map((comment) =>
      comment.id === commentId
        ? { ...comment, body: validation.body, editedAt }
        : comment,
    ),
  }));
  const updated = next.missionComments.find(
    (comment) => comment.id === commentId,
  );
  if (!updated) {
    throw new Error('update mission comment: comment vanished after update.');
  }
  return { comment: toMissionComment(updated, next.users), ok: true };
}

function deleteMissionCommentMemory(userId: string, commentId: string): boolean {
  const existing = getState().missionComments.find(
    (comment) => comment.id === commentId && comment.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    missionCommentReports: current.missionCommentReports.filter(
      (report) => report.missionCommentId !== commentId,
    ),
    missionComments: current.missionComments.filter(
      (comment) => comment.id !== commentId,
    ),
  }));
  return true;
}

function reportMissionCommentMemory(
  userId: string,
  commentId: string,
): ReportMissionCommentResult {
  if (!getState().missionComments.some((comment) => comment.id === commentId)) {
    return {
      code: 'mission_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().missionCommentReports.some(
    (report) =>
      report.missionCommentId === commentId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      missionCommentReports: [
        ...current.missionCommentReports,
        {
          createdAt: new Date().toISOString(),
          id: `mission-comment-report-${crypto.randomUUID()}`,
          missionCommentId: commentId,
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

export async function listMissionComments(
  ctx: RequestContext,
  missionId: string,
): Promise<readonly MissionComment[]> {
  return ctx.supabase
    ? listMissionCommentsSupabase(ctx.supabase, missionId)
    : listMissionCommentsMemory(missionId);
}

// The paginated, public-facing counterpart to listMissionComments (see
// listMissionCommentsPageMemory for why the two are kept separate).
export async function listMissionCommentsPage(
  ctx: RequestContext,
  missionId: string,
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<MissionCommentsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_MISSION_COMMENTS_PAGE_SIZE),
    MAX_MISSION_COMMENTS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listMissionCommentsPageSupabase(ctx.supabase, missionId, limit, cursor)
    : listMissionCommentsPageMemory(missionId, limit, cursor);
}

export async function createMissionComment(
  ctx: RequestContext,
  missionId: string,
  input: unknown,
): Promise<CreateMissionCommentResult> {
  return ctx.supabase
    ? createMissionCommentSupabase(ctx.supabase, ctx.userId, missionId, input)
    : createMissionCommentMemory(ctx.userId, missionId, input);
}

export async function updateMissionComment(
  ctx: RequestContext,
  commentId: string,
  input: unknown,
): Promise<UpdateMissionCommentResult> {
  return ctx.supabase
    ? updateMissionCommentSupabase(ctx.supabase, ctx.userId, commentId, input)
    : updateMissionCommentMemory(ctx.userId, commentId, input);
}

export async function deleteMissionComment(
  ctx: RequestContext,
  commentId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteMissionCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : deleteMissionCommentMemory(ctx.userId, commentId);
}

export async function reportMissionComment(
  ctx: RequestContext,
  commentId: string,
): Promise<ReportMissionCommentResult> {
  return ctx.supabase
    ? reportMissionCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : reportMissionCommentMemory(ctx.userId, commentId);
}

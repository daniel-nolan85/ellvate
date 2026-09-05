import type { RequestContext } from '@/src/backend/http';
import { createNotificationMemory } from '@/src/backend/notifications';
import {
  getState,
  setState,
  type StoredComment,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import type { ValidReportSubmission } from '../reports/report-submission';
import {
  createCommentSupabase,
  deleteCommentSupabase,
  listCommentsPageSupabase,
  listCommentsSupabase,
  listMyCommentsSupabase,
  reportCommentSupabase,
  updateCommentSupabase,
} from './comments-supabase';
import type {
  Comment,
  CommentsPage,
  CreateCommentResult,
  MyComment,
  PersonRef,
  ReportCommentResult,
  UpdateCommentResult,
} from './types';
import { validateCommentBody } from './validation';

export const DEFAULT_COMMENTS_PAGE_SIZE = 20;
export const MAX_COMMENTS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, isAdmin: user.isAdmin, name: user.name }
    : { avatarUrl: null, id, isAdmin: false, name: 'Member' };
};

const toComment = (
  stored: StoredComment,
  users: readonly StoredUser[],
): Comment => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
  editedAt: stored.editedAt,
  id: stored.id,
  postId: stored.postId,
});

function listCommentsMemory(postId: string): readonly Comment[] {
  const state = getState();
  return state.comments
    .filter((comment) => comment.postId === postId)
    .slice()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((comment) => toComment(comment, state.users));
}

// The paginated counterpart to listCommentsMemory (used by the public thread
// view; listCommentsMemory itself stays unbounded, e.g. for delete-account's
// cleanup scan). Oldest-first, matching the thread's natural reading order --
// paginateInMemory always sorts descending by sortKey, so the sortKey
// inverts the timestamp to preserve that ascending order (same trick used
// for missions' position and events' startsAt).
const MAX_COMMENT_TIMESTAMP = 9_999_999_999_999;

function listCommentsPageMemory(
  userId: string,
  postId: string,
  limit: number,
  cursor: string | null,
): CommentsPage {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const filtered = state.comments
    .filter((comment) => comment.postId === postId)
    .filter((comment) => !mutedUserIds.has(comment.authorId))
    .map((comment) => ({
      comment,
      id: comment.id,
      sortKey: String(
        MAX_COMMENT_TIMESTAMP - Date.parse(comment.createdAt),
      ).padStart(13, '0'),
    }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    comments: page.items.map((item) => toComment(item.comment, state.users)),
    nextCursor: page.nextCursor,
  };
}

function listMyCommentsMemory(userId: string): readonly MyComment[] {
  const state = getState();
  return state.comments
    .filter((comment) => comment.authorId === userId)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((comment) => {
      const post = state.posts.find((candidate) => candidate.id === comment.postId);
      return {
        body: comment.body,
        createdAt: comment.createdAt,
        id: comment.id,
        postId: comment.postId,
        postTitle: post?.title ?? 'a post',
      };
    });
}

function createCommentMemory(
  userId: string,
  postId: string,
  input: unknown,
): CreateCommentResult {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const post = getState().posts.find((candidate) => candidate.id === postId);
  if (!post) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  const stored: StoredComment = {
    authorId: userId,
    body: validation.body,
    createdAt: new Date().toISOString(),
    editedAt: null,
    id: `comment-${crypto.randomUUID()}`,
    postId,
  };
  const next = setState((current) => ({
    ...current,
    comments: [...current.comments, stored],
    posts: current.posts.map((candidate) =>
      candidate.id === postId
        ? { ...candidate, replies: candidate.replies + 1 }
        : candidate,
    ),
  }));
  // WHY: mirrors the Supabase `notify_post_author` trigger — skip notifying
  // yourself when you comment on your own post.
  if (post.authorId !== userId) {
    const commenter = next.users.find((candidate) => candidate.id === userId);
    createNotificationMemory(
      post.authorId,
      'comment',
      'New reply to your post',
      `${commenter?.name ?? 'Someone'} commented on "${post.title}"`,
      { commentId: stored.id, postId },
    );
  }
  return { comment: toComment(stored, next.users), ok: true };
}

function updateCommentMemory(
  userId: string,
  commentId: string,
  input: unknown,
): UpdateCommentResult {
  const existing = getState().comments.find((comment) => comment.id === commentId);
  if (!existing) {
    return {
      code: 'comment_not_found',
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
    comments: current.comments.map((comment) =>
      comment.id === commentId
        ? { ...comment, body: validation.body, editedAt }
        : comment,
    ),
  }));
  const updated = next.comments.find((comment) => comment.id === commentId);
  if (!updated) {
    throw new Error('update comment: comment vanished after update.');
  }
  return { comment: toComment(updated, next.users), ok: true };
}

function deleteCommentMemory(userId: string, commentId: string): boolean {
  const existing = getState().comments.find(
    (comment) => comment.id === commentId && comment.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    commentReports: current.commentReports.filter(
      (report) => report.commentId !== commentId,
    ),
    comments: current.comments.filter((comment) => comment.id !== commentId),
    posts: current.posts.map((post) =>
      post.id === existing.postId
        ? { ...post, replies: Math.max(0, post.replies - 1) }
        : post,
    ),
  }));
  return true;
}

function reportCommentMemory(
  userId: string,
  commentId: string,
  submission: ValidReportSubmission,
): ReportCommentResult {
  if (!getState().comments.some((comment) => comment.id === commentId)) {
    return { code: 'comment_not_found', message: 'Comment not found.', ok: false };
  }

  const alreadyReported = getState().commentReports.some(
    (report) => report.commentId === commentId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      commentReports: [
        ...current.commentReports,
        {
          commentId,
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `comment-report-${crypto.randomUUID()}`,
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

export async function listComments(
  ctx: RequestContext,
  postId: string,
): Promise<readonly Comment[]> {
  return ctx.supabase
    ? listCommentsSupabase(ctx.supabase, postId)
    : listCommentsMemory(postId);
}

// The paginated, public-facing counterpart to listComments (see
// listCommentsPageMemory for why the two are kept separate).
export async function listCommentsPage(
  ctx: RequestContext,
  postId: string,
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<CommentsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_COMMENTS_PAGE_SIZE),
    MAX_COMMENTS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listCommentsPageSupabase(ctx.supabase, ctx.userId, postId, limit, cursor)
    : listCommentsPageMemory(ctx.userId, postId, limit, cursor);
}

export async function listMyComments(
  ctx: RequestContext,
): Promise<readonly MyComment[]> {
  return ctx.supabase
    ? listMyCommentsSupabase(ctx.supabase, ctx.userId)
    : listMyCommentsMemory(ctx.userId);
}

export async function createComment(
  ctx: RequestContext,
  postId: string,
  input: unknown,
): Promise<CreateCommentResult> {
  return ctx.supabase
    ? createCommentSupabase(ctx.supabase, ctx.userId, postId, input)
    : createCommentMemory(ctx.userId, postId, input);
}

export async function updateComment(
  ctx: RequestContext,
  commentId: string,
  input: unknown,
): Promise<UpdateCommentResult> {
  return ctx.supabase
    ? updateCommentSupabase(ctx.supabase, ctx.userId, commentId, input)
    : updateCommentMemory(ctx.userId, commentId, input);
}

export async function deleteComment(
  ctx: RequestContext,
  commentId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : deleteCommentMemory(ctx.userId, commentId);
}

export async function reportComment(
  ctx: RequestContext,
  commentId: string,
  submission: ValidReportSubmission,
): Promise<ReportCommentResult> {
  return ctx.supabase
    ? reportCommentSupabase(ctx.supabase, ctx.userId, commentId, submission)
    : reportCommentMemory(ctx.userId, commentId, submission);
}

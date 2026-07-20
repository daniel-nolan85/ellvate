import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  setState,
  type StoredComment,
  type StoredUser,
} from '@/src/backend/store';

import {
  createCommentSupabase,
  deleteCommentSupabase,
  listCommentsSupabase,
  reportCommentSupabase,
} from './comments-supabase';
import type {
  Comment,
  CreateCommentResult,
  PersonRef,
  ReportCommentResult,
} from './types';
import { validateCommentBody } from './validation';

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id, name: 'Member' };
};

const toComment = (
  stored: StoredComment,
  users: readonly StoredUser[],
): Comment => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
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

function createCommentMemory(
  userId: string,
  postId: string,
  input: unknown,
): CreateCommentResult {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  if (!getState().posts.some((post) => post.id === postId)) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  const stored: StoredComment = {
    authorId: userId,
    body: validation.body,
    createdAt: new Date().toISOString(),
    id: `comment-${crypto.randomUUID()}`,
    postId,
  };
  const next = setState((current) => ({
    ...current,
    comments: [...current.comments, stored],
    posts: current.posts.map((post) =>
      post.id === postId ? { ...post, replies: post.replies + 1 } : post,
    ),
  }));
  return { comment: toComment(stored, next.users), ok: true };
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
          id: `comment-report-${crypto.randomUUID()}`,
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

export async function createComment(
  ctx: RequestContext,
  postId: string,
  input: unknown,
): Promise<CreateCommentResult> {
  return ctx.supabase
    ? createCommentSupabase(ctx.supabase, ctx.userId, postId, input)
    : createCommentMemory(ctx.userId, postId, input);
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
): Promise<ReportCommentResult> {
  return ctx.supabase
    ? reportCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : reportCommentMemory(ctx.userId, commentId);
}

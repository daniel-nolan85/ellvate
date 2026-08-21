import { validateCommentBody } from '@/src/backend/comments';
import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  setState,
  type StoredPetitionComment,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  createPetitionCommentSupabase,
  deletePetitionCommentSupabase,
  listPetitionCommentsPageSupabase,
  listPetitionCommentsSupabase,
  reportPetitionCommentSupabase,
  updatePetitionCommentSupabase,
} from './petition-comments-supabase';
import type {
  CreatePetitionCommentResult,
  PersonRef,
  PetitionComment,
  PetitionCommentsPage,
  ReportPetitionCommentResult,
  UpdatePetitionCommentResult,
} from './types';

export const DEFAULT_PETITION_COMMENTS_PAGE_SIZE = 20;
export const MAX_PETITION_COMMENTS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const authorRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id, name: 'Member' };
};

const toPetitionComment = (
  stored: StoredPetitionComment,
  users: readonly StoredUser[],
): PetitionComment => ({
  author: authorRef(users, stored.authorId),
  body: stored.body,
  createdAt: stored.createdAt,
  editedAt: stored.editedAt,
  id: stored.id,
  petitionId: stored.petitionId,
});

function listPetitionCommentsMemory(petitionId: string): readonly PetitionComment[] {
  const state = getState();
  return state.petitionComments
    .filter((comment) => comment.petitionId === petitionId)
    .slice()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((comment) => toPetitionComment(comment, state.users));
}

const MAX_PETITION_COMMENT_TIMESTAMP = 9_999_999_999_999;

function listPetitionCommentsPageMemory(
  petitionId: string,
  limit: number,
  cursor: string | null,
): PetitionCommentsPage {
  const state = getState();
  const filtered = state.petitionComments
    .filter((comment) => comment.petitionId === petitionId)
    .map((comment) => ({
      comment,
      id: comment.id,
      sortKey: String(
        MAX_PETITION_COMMENT_TIMESTAMP - Date.parse(comment.createdAt),
      ).padStart(13, '0'),
    }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    comments: page.items.map((item) => toPetitionComment(item.comment, state.users)),
    nextCursor: page.nextCursor,
  };
}

function createPetitionCommentMemory(
  userId: string,
  petitionId: string,
  input: unknown,
): CreatePetitionCommentResult {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const petition = getState().petitions.find((candidate) => candidate.id === petitionId);
  if (!petition) {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }
  const stored: StoredPetitionComment = {
    authorId: userId,
    body: validation.body,
    createdAt: new Date().toISOString(),
    editedAt: null,
    id: `petition-comment-${crypto.randomUUID()}`,
    petitionId,
  };
  const next = setState((current) => ({
    ...current,
    petitionComments: [...current.petitionComments, stored],
  }));
  return { comment: toPetitionComment(stored, next.users), ok: true };
}

function updatePetitionCommentMemory(
  userId: string,
  commentId: string,
  input: unknown,
): UpdatePetitionCommentResult {
  const existing = getState().petitionComments.find((comment) => comment.id === commentId);
  if (!existing) {
    return {
      code: 'petition_comment_not_found',
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
    petitionComments: current.petitionComments.map((comment) =>
      comment.id === commentId ? { ...comment, body: validation.body, editedAt } : comment,
    ),
  }));
  const updated = next.petitionComments.find((comment) => comment.id === commentId);
  if (!updated) {
    throw new Error('update petition comment: comment vanished after update.');
  }
  return { comment: toPetitionComment(updated, next.users), ok: true };
}

function deletePetitionCommentMemory(userId: string, commentId: string): boolean {
  const existing = getState().petitionComments.find(
    (comment) => comment.id === commentId && comment.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    petitionCommentReports: current.petitionCommentReports.filter(
      (report) => report.petitionCommentId !== commentId,
    ),
    petitionComments: current.petitionComments.filter((comment) => comment.id !== commentId),
  }));
  return true;
}

function reportPetitionCommentMemory(
  userId: string,
  commentId: string,
): ReportPetitionCommentResult {
  if (!getState().petitionComments.some((comment) => comment.id === commentId)) {
    return {
      code: 'petition_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }
  const alreadyReported = getState().petitionCommentReports.some(
    (report) => report.petitionCommentId === commentId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      petitionCommentReports: [
        ...current.petitionCommentReports,
        {
          createdAt: new Date().toISOString(),
          id: `petition-comment-report-${crypto.randomUUID()}`,
          petitionCommentId: commentId,
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

export async function listPetitionComments(
  ctx: RequestContext,
  petitionId: string,
): Promise<readonly PetitionComment[]> {
  return ctx.supabase
    ? listPetitionCommentsSupabase(ctx.supabase, petitionId)
    : listPetitionCommentsMemory(petitionId);
}

export async function listPetitionCommentsPage(
  ctx: RequestContext,
  petitionId: string,
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<PetitionCommentsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_PETITION_COMMENTS_PAGE_SIZE),
    MAX_PETITION_COMMENTS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listPetitionCommentsPageSupabase(ctx.supabase, petitionId, limit, cursor)
    : listPetitionCommentsPageMemory(petitionId, limit, cursor);
}

export async function createPetitionComment(
  ctx: RequestContext,
  petitionId: string,
  input: unknown,
): Promise<CreatePetitionCommentResult> {
  return ctx.supabase
    ? createPetitionCommentSupabase(ctx.supabase, ctx.userId, petitionId, input)
    : createPetitionCommentMemory(ctx.userId, petitionId, input);
}

export async function updatePetitionComment(
  ctx: RequestContext,
  commentId: string,
  input: unknown,
): Promise<UpdatePetitionCommentResult> {
  return ctx.supabase
    ? updatePetitionCommentSupabase(ctx.supabase, ctx.userId, commentId, input)
    : updatePetitionCommentMemory(ctx.userId, commentId, input);
}

export async function deletePetitionComment(
  ctx: RequestContext,
  commentId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deletePetitionCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : deletePetitionCommentMemory(ctx.userId, commentId);
}

export async function reportPetitionComment(
  ctx: RequestContext,
  commentId: string,
): Promise<ReportPetitionCommentResult> {
  return ctx.supabase
    ? reportPetitionCommentSupabase(ctx.supabase, ctx.userId, commentId)
    : reportPetitionCommentMemory(ctx.userId, commentId);
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { validateCommentBody } from '@/src/backend/comments';
import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type {
  CreatePetitionCommentResult,
  PetitionComment,
  PetitionCommentsPage,
  ReportPetitionCommentResult,
  UpdatePetitionCommentResult,
} from './types';

const PETITION_COMMENT_SELECT =
  'id,petition_id,author_id,body,created_at,edited_at,author:app_users!petition_comments_author_id_fkey(id,name,avatar_url,is_admin)';

interface PetitionCommentRow {
  readonly id: string;
  readonly petition_id: string;
  readonly author_id: string;
  readonly body: string;
  readonly created_at: string;
  readonly edited_at: string | null;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

const toPetitionComment = (row: PetitionCommentRow): PetitionComment => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    isAdmin: row.author?.is_admin ?? false,
    name: row.author?.name ?? 'Member',
  },
  body: row.body,
  createdAt: row.created_at,
  editedAt: row.edited_at,
  id: row.id,
  petitionId: row.petition_id,
});

const ensureUser = async (supabase: SupabaseClient, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name: 'Member' }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure petition comment user');
};

export async function listPetitionCommentsSupabase(
  supabase: SupabaseClient,
  petitionId: string,
): Promise<readonly PetitionComment[]> {
  const { data, error } = await supabase
    .from('petition_comments')
    .select(PETITION_COMMENT_SELECT)
    .eq('petition_id', petitionId)
    .order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'load petition comments');
  return (data as unknown as PetitionCommentRow[]).map(toPetitionComment);
}

const MAX_PETITION_COMMENT_TIMESTAMP = 9_999_999_999_999;

export async function listPetitionCommentsPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  petitionId: string,
  limit: number,
  cursor: string | null,
): Promise<PetitionCommentsPage> {
  const [{ data, error }, mutedUserIds] = await Promise.all([
    supabase
      .from('petition_comments')
      .select(PETITION_COMMENT_SELECT)
      .eq('petition_id', petitionId)
      .order('created_at', { ascending: true }),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load petition comments');
  const mutedSet = new Set(mutedUserIds);
  const rows = ((data as unknown as PetitionCommentRow[]) ?? []).filter(
    (row) => !mutedSet.has(row.author_id),
  );

  const wrapped = rows.map((row) => ({
    id: row.id,
    row,
    sortKey: String(
      MAX_PETITION_COMMENT_TIMESTAMP - Date.parse(row.created_at),
    ).padStart(13, '0'),
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    comments: page.items.map((item) => toPetitionComment(item.row)),
    nextCursor: page.nextCursor,
  };
}

export async function createPetitionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  petitionId: string,
  input: unknown,
): Promise<CreatePetitionCommentResult> {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const { data: petition, error: petitionError } = await supabase
    .from('petitions')
    .select('id')
    .eq('id', petitionId)
    .maybeSingle();
  throwIfSupabaseError(petitionError, 'load comment petition');
  if (!petition) {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }
  await ensureUser(supabase, userId);
  const { data, error } = await supabase
    .from('petition_comments')
    .insert({ author_id: userId, body: validation.body, petition_id: petitionId })
    .select(PETITION_COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'create petition comment');
  if (!data) {
    throw new Error('create petition comment: database returned no comment.');
  }
  return { comment: toPetitionComment(data as unknown as PetitionCommentRow), ok: true };
}

export async function updatePetitionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
  input: unknown,
): Promise<UpdatePetitionCommentResult> {
  const { data: existing, error: existingError } = await supabase
    .from('petition_comments')
    .select('id,author_id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load petition comment for update');
  if (!existing) {
    return {
      code: 'petition_comment_not_found',
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
    .from('petition_comments')
    .update({ body: validation.body, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select(PETITION_COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'update petition comment');
  if (!data) {
    throw new Error('update petition comment: database returned no comment.');
  }
  return { comment: toPetitionComment(data as unknown as PetitionCommentRow), ok: true };
}

export async function deletePetitionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('petition_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id');
  throwIfSupabaseError(error, 'delete petition comment');
  return Array.isArray(data) && data.length > 0;
}

export async function reportPetitionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<ReportPetitionCommentResult> {
  const { data: comment, error: commentError } = await supabase
    .from('petition_comments')
    .select('id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(commentError, 'load reported petition comment');
  if (!comment) {
    return {
      code: 'petition_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }
  await ensureUser(supabase, userId);
  const { error } = await supabase
    .from('petition_comment_reports')
    .upsert(
      { petition_comment_id: commentId, reporter_id: userId },
      { ignoreDuplicates: true, onConflict: 'petition_comment_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report petition comment');
  return { ok: true, reported: true };
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { Comment, CreateCommentResult } from './types';
import { validateCommentBody } from './validation';

const COMMENT_SELECT =
  'id,post_id,author_id,body,created_at,author:app_users!comments_author_id_fkey(id,name)';

interface CommentRow {
  readonly id: string;
  readonly post_id: string;
  readonly author_id: string;
  readonly body: string;
  readonly created_at: string;
  readonly author: { readonly id: string; readonly name: string } | null;
}

const toComment = (row: CommentRow): Comment => ({
  author: { id: row.author_id, name: row.author?.name ?? 'Member' },
  body: row.body,
  createdAt: row.created_at,
  id: row.id,
  postId: row.post_id,
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
  throwIfSupabaseError(error, 'ensure comment user');
};

export async function listCommentsSupabase(
  supabase: SupabaseClient,
  postId: string,
): Promise<readonly Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'load comments');
  return (data as unknown as CommentRow[]).map(toComment);
}

export async function createCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  input: unknown,
): Promise<CreateCommentResult> {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle();
  throwIfSupabaseError(postError, 'load comment post');
  if (!post) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  await ensureUser(supabase, userId);
  const { data, error } = await supabase
    .from('comments')
    .insert({ author_id: userId, body: validation.body, post_id: postId })
    .select(COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'create comment');
  if (!data) {
    throw new Error('create comment: database returned no comment.');
  }
  return { comment: toComment(data as unknown as CommentRow), ok: true };
}

export async function deleteCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id');
  throwIfSupabaseError(error, 'delete comment');
  return Array.isArray(data) && data.length > 0;
}

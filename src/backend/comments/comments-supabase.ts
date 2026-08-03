import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type {
  Comment,
  CreateCommentResult,
  MyComment,
  ReportCommentResult,
  UpdateCommentResult,
} from './types';
import { validateCommentBody } from './validation';

const COMMENT_SELECT =
  'id,post_id,author_id,body,created_at,edited_at,author:app_users!comments_author_id_fkey(id,name,avatar_url)';

const MY_COMMENT_SELECT =
  'id,post_id,body,created_at,post:posts!comments_post_id_fkey(title)';

interface MyCommentRow {
  readonly id: string;
  readonly post_id: string;
  readonly body: string;
  readonly created_at: string;
  readonly post: { readonly title: string } | null;
}

interface CommentRow {
  readonly id: string;
  readonly post_id: string;
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

const toComment = (row: CommentRow): Comment => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    name: row.author?.name ?? 'Member',
  },
  body: row.body,
  createdAt: row.created_at,
  editedAt: row.edited_at,
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

export async function listMyCommentsSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<readonly MyComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(MY_COMMENT_SELECT)
    .eq('author_id', userId)
    .order('created_at', { ascending: false });
  throwIfSupabaseError(error, 'load my comments');
  return (data as unknown as MyCommentRow[]).map((row) => ({
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    postId: row.post_id,
    postTitle: row.post?.title ?? 'a post',
  }));
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

export async function updateCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
  input: unknown,
): Promise<UpdateCommentResult> {
  const { data: existing, error: existingError } = await supabase
    .from('comments')
    .select('id,author_id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load comment for update');
  if (!existing) {
    return {
      code: 'comment_not_found',
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
    .from('comments')
    .update({ body: validation.body, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select(COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'update comment');
  if (!data) {
    throw new Error('update comment: database returned no comment.');
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

export async function reportCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<ReportCommentResult> {
  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select('id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(commentError, 'load reported comment');
  if (!comment) {
    return { code: 'comment_not_found', message: 'Comment not found.', ok: false };
  }

  await ensureUser(supabase, userId);
  // Idempotent: a unique (comment_id, reporter_id) constraint on
  // comment_reports means a repeat report from the same user is a silent
  // no-op, not an error.
  const { error } = await supabase
    .from('comment_reports')
    .upsert(
      { comment_id: commentId, reporter_id: userId },
      { ignoreDuplicates: true, onConflict: 'comment_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report comment');
  return { ok: true, reported: true };
}

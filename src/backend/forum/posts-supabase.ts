import type { SupabaseClient } from '@supabase/supabase-js';

import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { throwIfSupabaseError } from '@/src/services/supabase';
import { uploadDataUrl } from '@/src/services/storage/storage-client';

import type {
  CreatePostResult,
  ForumPost,
  LikeResult,
  Media,
  UpdatePostResult,
} from './types';
import {
  extractExistingMedia,
  extractMediaUploads,
  validatePostInput,
} from './validation';

const POST_SELECT =
  'id,forum,author_id,title,excerpt,media,like_count,reply_count,pinned,created_at,author:app_users!posts_author_id_fkey(id,name,avatar_url)';

interface PostRow {
  readonly id: string;
  readonly forum: string;
  readonly author_id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly media: readonly Media[] | null;
  readonly like_count: number;
  readonly reply_count: number;
  readonly pinned: boolean;
  readonly created_at: string;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
  } | null;
}

const toForumPost = (
  row: PostRow,
  likedIds: ReadonlySet<string>,
): ForumPost => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    name: row.author?.name ?? 'Member',
  },
  createdAt: row.created_at,
  excerpt: row.excerpt,
  forum: row.forum,
  id: row.id,
  liked: likedIds.has(row.id),
  likes: row.like_count,
  media: row.media ?? undefined,
  pinned: row.pinned,
  replies: row.reply_count,
  title: row.title,
});

// Uploads each picked image to Supabase Storage under the post's own id and
// returns the subset that succeeded; a failed upload is dropped rather than
// failing the whole post so one bad image can't block publishing.
const uploadPostMedia = async (
  postId: string,
  input: unknown,
): Promise<readonly Media[]> => {
  const uploads = extractMediaUploads(input);
  const results = await Promise.all(
    uploads.map(async (upload) => {
      const url = await uploadDataUrl(
        upload.dataUrl,
        upload.filename,
        'posts',
        postId,
      );
      return url ? { filename: upload.filename, url } : null;
    }),
  );
  return results.filter((media): media is Media => media !== null);
};

const likedPostIds = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<ReadonlySet<string>> => {
  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId);
  throwIfSupabaseError(error, 'load post likes');
  return new Set((data ?? []).map((row) => row.post_id as string));
};

// A new Clerk user has no app_users row yet; create it before any owned write so
// foreign keys resolve. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = 'Member',
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure forum user');
};

const listForumNames = async (
  supabase: SupabaseClient,
): Promise<readonly string[]> => {
  const { data, error } = await supabase
    .from('subforums')
    .select('name')
    .order('position', { ascending: true });
  throwIfSupabaseError(error, 'load subforums');
  return (data ?? []).map((row) => row.name as string);
};

export async function listSubforumsSupabase(
  supabase: SupabaseClient,
): Promise<readonly string[]> {
  return listForumNames(supabase);
}

export async function listPostsSupabase(
  supabase: SupabaseClient,
  userId: string,
  forum?: string,
): Promise<readonly ForumPost[]> {
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (forum && forum !== 'All') {
    query = query.eq('forum', forum);
  }
  const { data, error } = await query;
  throwIfSupabaseError(error, 'load posts');
  const [likedIds, mutedUserIds] = await Promise.all([
    likedPostIds(supabase, userId),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  const mutedSet = new Set(mutedUserIds);
  return (data as unknown as PostRow[])
    .filter((row) => !mutedSet.has(row.author_id))
    .map((row) => toForumPost(row, likedIds));
}

export async function createPostSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<CreatePostResult> {
  const validation = validatePostInput(input, await listForumNames(supabase));
  if (!validation.ok) {
    return validation;
  }
  await ensureUser(supabase, userId);
  const { data: inserted, error: insertError } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      excerpt: validation.value.excerpt,
      forum: validation.value.forum,
      title: validation.value.title,
    })
    .select(POST_SELECT)
    .single();
  throwIfSupabaseError(insertError, 'create post');
  if (!inserted) {
    throw new Error('create post: database returned no post.');
  }
  const insertedRow = inserted as unknown as PostRow;

  const media = await uploadPostMedia(insertedRow.id, input);
  if (media.length === 0) {
    return { ok: true, post: toForumPost(insertedRow, new Set()) };
  }

  const { data: updated, error: updateError } = await supabase
    .from('posts')
    .update({ media })
    .eq('id', insertedRow.id)
    .select(POST_SELECT)
    .single();
  throwIfSupabaseError(updateError, 'attach post media');
  return {
    ok: true,
    post: toForumPost((updated as unknown as PostRow) ?? insertedRow, new Set()),
  };
}

export async function toggleLikeSupabase(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<LikeResult | null> {
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle();
  throwIfSupabaseError(postError, 'load post');
  if (!post) {
    return null;
  }
  await ensureUser(supabase, userId);
  const { data: existing, error: existingError } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  throwIfSupabaseError(existingError, 'load post membership');

  if (existing) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    throwIfSupabaseError(error, 'unlike post');
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: postId, user_id: userId });
    throwIfSupabaseError(error, 'like post');
  }

  const { data: updated, error: updatedError } = await supabase
    .from('posts')
    .select('like_count')
    .eq('id', postId)
    .single();
  throwIfSupabaseError(updatedError, 'load post like count');
  return { id: postId, liked: !existing, likes: updated?.like_count ?? 0 };
}

export async function deletePostSupabase(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<boolean> {
  const { data: existing, error: existingError } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', postId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load post');
  if (!existing || existing.author_id !== userId) {
    return false;
  }
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  throwIfSupabaseError(error, 'delete post');
  return true;
}

export async function updatePostSupabase(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  input: unknown,
): Promise<UpdatePostResult> {
  const { data: existing, error: existingError } = await supabase
    .from('posts')
    .select('id, author_id, forum')
    .eq('id', postId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load post');
  if (!existing) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  if (existing.author_id !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own posts.',
      ok: false,
    };
  }
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const validation = validatePostInput(
    { excerpt: raw.excerpt, forum: existing.forum, title: raw.title },
    await listForumNames(supabase),
  );
  if (!validation.ok) {
    return validation;
  }
  const keptMedia = extractExistingMedia(input);
  const uploadedMedia = await uploadPostMedia(postId, input);
  const media = [...keptMedia, ...uploadedMedia];

  const { data, error } = await supabase
    .from('posts')
    .update({
      excerpt: validation.value.excerpt,
      media: media.length ? media : null,
      title: validation.value.title,
    })
    .eq('id', postId)
    .select(POST_SELECT)
    .single();
  throwIfSupabaseError(error, 'update post');
  if (!data) {
    throw new Error('update post: database returned no post.');
  }
  const likedIds = await likedPostIds(supabase, userId);
  return { ok: true, post: toForumPost(data as unknown as PostRow, likedIds) };
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { defaultDisplayName } from '@/src/backend/store';
import { decodeCursor, encodeCursor } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';
import { removeStorageObjects, uploadDataUrl } from '@/src/services/storage';

import type {
  CreatedPostResult,
  ForumPost,
  ForumPostsPage,
  LikeResult,
  Media,
  MyPostsPage,
  TogglePinResult,
  UpdatePostResult,
} from './types';
import {
  extractExistingMedia,
  extractMediaUploads,
  validatePostInput,
} from './validation';

const POST_SELECT =
  'id,forum,author_id,title,excerpt,media,like_count,reply_count,created_at,edited_at,author:app_users!posts_author_id_fkey(id,name,avatar_url,is_admin)';

// The cursor's sortKey/id (a created_at timestamp and a post id) are
// client-supplied and get spliced into a raw PostgREST `.or()` filter string
// below -- PostgREST's filter syntax treats `,`, `(`, and `)` as structural
// delimiters, so an unvalidated value could inject extra conditions or
// grouping. Reject anything that doesn't look like the shapes we actually
// produce (an ISO timestamp, a plain id) rather than trust it verbatim.
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// Exported for a direct unit test -- the Supabase code paths that call this
// aren't otherwise exercised outside a live Supabase project.
export function safeCursorOrFilter(
  parsedCursor: { readonly sortKey: string; readonly id: string } | null,
): string | null {
  if (!parsedCursor) {
    return null;
  }
  if (
    !ISO_TIMESTAMP_PATTERN.test(parsedCursor.sortKey) ||
    !SAFE_ID_PATTERN.test(parsedCursor.id)
  ) {
    return null;
  }
  return `created_at.lt.${parsedCursor.sortKey},and(created_at.eq.${parsedCursor.sortKey},id.lt.${parsedCursor.id})`;
}

interface PostRow {
  readonly id: string;
  readonly forum: string;
  readonly author_id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly media: readonly Media[] | null;
  readonly like_count: number;
  readonly reply_count: number;
  readonly created_at: string;
  readonly edited_at: string | null;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

type UploadPostMediaResult =
  | { readonly ok: true; readonly media: readonly Media[] }
  | { readonly ok: false; readonly uploaded: readonly Media[] };

// pinned is viewer-relative — a Twitter/Telegram-style personal pin stored
// on app_users.pinned_post_id, not a shared column on posts — so it takes
// the viewing user's own pinned post id, not anything off the row itself.
const toForumPost = (
  row: PostRow,
  likedIds: ReadonlySet<string>,
  viewerPinnedPostId: string | null,
): ForumPost => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    isAdmin: row.author?.is_admin ?? false,
    name: row.author?.name ?? 'Member',
  },
  createdAt: row.created_at,
  editedAt: row.edited_at,
  excerpt: row.excerpt,
  forum: row.forum,
  id: row.id,
  liked: likedIds.has(row.id),
  likes: row.like_count,
  media: row.media ?? undefined,
  pinned: row.id === viewerPinnedPostId,
  replies: row.reply_count,
  title: row.title,
});

const byPinnedThenNewest =
  (viewerPinnedPostId: string | null) =>
  (a: PostRow, b: PostRow): number => {
    const aPinned = a.id === viewerPinnedPostId;
    const bPinned = b.id === viewerPinnedPostId;
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  };

// Uploads each picked image to Supabase Storage under the post's own id.
// WHY: a failed upload is surfaced as `ok: false` (with whatever succeeded so
// far in `uploaded`) rather than silently dropped — publishing a post that's
// missing images the user picked would misrepresent what actually got saved.
const uploadPostMedia = async (
  supabase: SupabaseClient,
  postId: string,
  input: unknown,
): Promise<UploadPostMediaResult> => {
  const uploads = extractMediaUploads(input);
  if (uploads.length === 0) {
    return { media: [], ok: true };
  }
  const results = await Promise.all(
    uploads.map(async (upload) => {
      const url = await uploadDataUrl(
        supabase,
        upload.dataUrl,
        upload.filename,
        'posts',
        postId,
      );
      return url ? { filename: upload.filename, url } : null;
    }),
  );
  const succeeded = results.filter((media): media is Media => media !== null);
  if (succeeded.length !== results.length) {
    return { ok: false, uploaded: succeeded };
  }
  return { media: succeeded, ok: true };
};

const MEDIA_UPLOAD_FAILED_MESSAGE =
  'One or more images failed to upload. Please try again.';

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

const getPinnedPostId = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('app_users')
    .select('pinned_post_id')
    .eq('id', userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'load pinned post');
  return (data?.pinned_post_id as string | null) ?? null;
};

// A new Clerk user has no app_users row yet; create it before any owned write so
// foreign keys resolve. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = defaultDisplayName(userId),
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
    .order('created_at', { ascending: false });
  if (forum && forum !== 'All') {
    query = query.eq('forum', forum);
  }
  const { data, error } = await query;
  throwIfSupabaseError(error, 'load posts');
  const [likedIds, mutedUserIds, viewerPinnedPostId] = await Promise.all([
    likedPostIds(supabase, userId),
    getMutedUserIdsSupabase(supabase, userId),
    getPinnedPostId(supabase, userId),
  ]);
  const mutedSet = new Set(mutedUserIds);
  const rows = (data as unknown as PostRow[]).filter(
    (row) => !mutedSet.has(row.author_id),
  );
  return [...rows]
    .sort(byPinnedThenNewest(viewerPinnedPostId))
    .map((row) => toForumPost(row, likedIds, viewerPinnedPostId));
}

// The paginated counterpart to listPostsSupabase (see listPostsPageMemory in
// posts.ts for why the two stay separate). The viewer's pinned post is
// fetched via its own indexed id lookup and prepended only on page 1 --
// looking it up separately (rather than hoping it falls inside the current
// keyset window) is what keeps this correct regardless of how old the pin is.
export async function listPostsPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  forum: string | undefined,
  limit: number,
  cursor: string | null,
): Promise<ForumPostsPage> {
  const [mutedUserIds, viewerPinnedPostId] = await Promise.all([
    getMutedUserIdsSupabase(supabase, userId),
    getPinnedPostId(supabase, userId),
  ]);
  const mutedSet = new Set(mutedUserIds);

  let pinnedRow: PostRow | null = null;
  if (!cursor && viewerPinnedPostId) {
    const { data: pinnedData, error: pinnedError } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', viewerPinnedPostId)
      .maybeSingle();
    throwIfSupabaseError(pinnedError, 'load pinned post');
    pinnedRow = pinnedData as unknown as PostRow | null;
  }

  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (forum && forum !== 'All') {
    query = query.eq('forum', forum);
  }
  if (viewerPinnedPostId) {
    query = query.neq('id', viewerPinnedPostId);
  }
  const cursorFilter = safeCursorOrFilter(cursor ? decodeCursor(cursor) : null);
  if (cursorFilter) {
    query = query.or(cursorFilter);
  }

  const { data, error } = await query;
  throwIfSupabaseError(error, 'load posts');
  const rows = data as unknown as PostRow[];
  const hasMore = rows.length > limit;
  const fetchedPage = hasMore ? rows.slice(0, limit) : rows;
  const visibleRows = fetchedPage.filter((row) => !mutedSet.has(row.author_id));

  const likedIds = await likedPostIds(supabase, userId);

  const last = fetchedPage[fetchedPage.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ id: last.id, sortKey: last.created_at }) : null;

  const orderedRows =
    pinnedRow && !mutedSet.has(pinnedRow.author_id)
      ? [pinnedRow, ...visibleRows]
      : visibleRows;

  return {
    nextCursor,
    posts: orderedRows.map((row) => toForumPost(row, likedIds, viewerPinnedPostId)),
  };
}

// Scoped to posts the caller authored — bounded by one user's own activity
// rather than the whole forum feed (unlike listPostsSupabase, which every
// screen but the activity hub needs). A single `author_id` filter, so this
// can use a true DB-level keyset query rather than merge-then-paginate.
export async function getMyPostsSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
): Promise<MyPostsPage> {
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  const cursorFilter = safeCursorOrFilter(cursor ? decodeCursor(cursor) : null);
  if (cursorFilter) {
    query = query.or(cursorFilter);
  }

  const { data, error } = await query;
  throwIfSupabaseError(error, 'load my posts');
  const rows = data as unknown as PostRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const [likedIds, viewerPinnedPostId] = await Promise.all([
    likedPostIds(supabase, userId),
    getPinnedPostId(supabase, userId),
  ]);

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ id: last.id, sortKey: last.created_at }) : null;

  return {
    nextCursor,
    posts: page.map((row) => toForumPost(row, likedIds, viewerPinnedPostId)),
  };
}

// Fetches specific posts by id — used to hydrate bookmarks, which can point
// at any post regardless of author/forum. Applies the same muted-author
// filter listPostsSupabase does: mute is the app's one visibility rule, so a
// muted author's post should stay hidden even if it was bookmarked before
// the mute happened.
// includeViewerState is false for a caller that only displays these posts
// read-only (the weekly digest's "Popular Posts" preview, which renders
// just title/like-count/reply-count -- see PopularPostRow) and never reads
// `.liked`/`.pinned` off the result. Skipping the two queries that compute
// them removes 2 of this function's 4 subrequests when they'd otherwise go
// unused, which matters on a hosting platform that caps subrequests per
// request (see missions-supabase.ts's MISSION_SELECT comment for the full
// story). Mute-filtering always still applies -- that's content visibility,
// not per-viewer UI state, so it's never worth skipping.
export async function getPostsByIdsSupabase(
  supabase: SupabaseClient,
  userId: string,
  ids: readonly string[],
  includeViewerState = true,
): Promise<readonly ForumPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .in('id', ids);
  throwIfSupabaseError(error, 'load posts by id');
  const [likedIds, mutedUserIds, viewerPinnedPostId] = await Promise.all([
    includeViewerState ? likedPostIds(supabase, userId) : Promise.resolve(new Set<string>()),
    getMutedUserIdsSupabase(supabase, userId),
    includeViewerState ? getPinnedPostId(supabase, userId) : Promise.resolve(null),
  ]);
  const mutedSet = new Set(mutedUserIds);
  return (data as unknown as PostRow[])
    .filter((row) => !mutedSet.has(row.author_id))
    .map((row) => toForumPost(row, likedIds, viewerPinnedPostId));
}

export async function createPostSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<CreatedPostResult> {
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

  const mediaResult = await uploadPostMedia(supabase, insertedRow.id, input);
  if (!mediaResult.ok) {
    await removeStorageObjects(
      supabase,
      mediaResult.uploaded.map((media) => media.url),
    );
    await supabase.from('posts').delete().eq('id', insertedRow.id);
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  // A brand-new post can never already be the caller's pinned post (its id
  // didn't exist a moment ago), so pinned is always false here.
  if (mediaResult.media.length === 0) {
    return { ok: true, post: toForumPost(insertedRow, new Set(), null) };
  }

  const { data: updated, error: updateError } = await supabase
    .from('posts')
    .update({ media: mediaResult.media })
    .eq('id', insertedRow.id)
    .select(POST_SELECT)
    .single();
  throwIfSupabaseError(updateError, 'attach post media');
  return {
    ok: true,
    post: toForumPost((updated as unknown as PostRow) ?? insertedRow, new Set(), null),
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

// Pinning is a Twitter/Telegram-style personal pin (see togglePinMemory):
// any signed-in member can pin any post, but it's exclusive and private to
// them, stored on app_users.pinned_post_id rather than the post itself. The
// toggle_post_pin() SECURITY DEFINER function (see 0019 migration) resolves
// the caller from the JWT itself (clerk_user_id()), not a client-supplied
// id, so a request can't toggle another user's pin by passing their id.
export async function togglePinSupabase(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<TogglePinResult> {
  const { data: existing, error: existingError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load post');
  if (!existing) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  // A new Clerk user pinning before ever posting/liking has no app_users row
  // yet — the RPC's update would silently affect 0 rows without this.
  await ensureUser(supabase, userId);
  const { data: pinned, error } = await supabase.rpc('toggle_post_pin', {
    post_id: postId,
  });
  throwIfSupabaseError(error, 'toggle post pin');
  return { id: postId, ok: true, pinned: pinned ?? false };
}

export async function deletePostSupabase(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<boolean> {
  const { data: existing, error: existingError } = await supabase
    .from('posts')
    .select('id, author_id, media')
    .eq('id', postId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load post');
  if (!existing || existing.author_id !== userId) {
    return false;
  }
  // WHY: clean up Storage before deleting the row — owner-scoped Storage RLS
  // (see 0007) verifies ownership by looking the post back up, so the row
  // must still exist when the cleanup call runs.
  const media = (existing.media as readonly Media[] | null) ?? [];
  await removeStorageObjects(
    supabase,
    media.map((item) => item.url),
  );
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
    .select('id, author_id, forum, media')
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
  const requestedForum =
    typeof raw.forum === 'string' && raw.forum.trim() ? raw.forum : existing.forum;
  const validation = validatePostInput(
    { excerpt: raw.excerpt, forum: requestedForum, title: raw.title },
    await listForumNames(supabase),
  );
  if (!validation.ok) {
    return validation;
  }
  const keptMedia = extractExistingMedia(input);
  const uploadResult = await uploadPostMedia(supabase, postId, input);
  if (!uploadResult.ok) {
    await removeStorageObjects(
      supabase,
      uploadResult.uploaded.map((media) => media.url),
    );
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  const media = [...keptMedia, ...uploadResult.media];

  const { data, error } = await supabase
    .from('posts')
    .update({
      excerpt: validation.value.excerpt,
      forum: validation.value.forum,
      media: media.length ? media : null,
      title: validation.value.title,
      edited_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .select(POST_SELECT)
    .single();
  throwIfSupabaseError(error, 'update post');
  if (!data) {
    throw new Error('update post: database returned no post.');
  }

  const previousMedia = (existing.media as readonly Media[] | null) ?? [];
  const keptUrls = new Set(keptMedia.map((item) => item.url));
  const removedMedia = previousMedia.filter((item) => !keptUrls.has(item.url));
  await removeStorageObjects(
    supabase,
    removedMedia.map((item) => item.url),
  );

  const [likedIds, viewerPinnedPostId] = await Promise.all([
    likedPostIds(supabase, userId),
    getPinnedPostId(supabase, userId),
  ]);
  return {
    ok: true,
    post: toForumPost(data as unknown as PostRow, likedIds, viewerPinnedPostId),
  };
}

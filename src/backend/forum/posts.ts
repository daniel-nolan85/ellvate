import type { RequestContext } from '@/src/backend/http';
import { createNotificationMemory } from '@/src/backend/notifications';
import {
  getState,
  SEED_NOW_ISO,
  setState,
  type StoredPost,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  createPostSupabase,
  deletePostSupabase,
  getMyPostsSupabase,
  getPostsByIdsSupabase,
  listPostsSupabase,
  toggleLikeSupabase,
  togglePinSupabase,
  updatePostSupabase,
} from './posts-supabase';
import type {
  CreatePostResult,
  ForumPost,
  LikeResult,
  MyPostsOptions,
  MyPostsPage,
  PersonRef,
  TogglePinResult,
  UpdatePostResult,
} from './types';

import {
  extractExistingMedia,
  extractMediaUploads,
  validatePostInput,
} from './validation';

export const DEFAULT_MY_POSTS_PAGE_SIZE = 20;
export const MAX_MY_POSTS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const toAuthorRef = (
  users: readonly StoredUser[],
  authorId: string,
): PersonRef => {
  const user = users.find((candidate) => candidate.id === authorId);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id: authorId, name: 'You' };
};

// pinned is viewer-relative — a Twitter/Telegram-style personal pin, not a
// shared post property (see StoredUser.pinnedPostId) — so computing it needs
// the viewing user's own pinnedPostId, not anything stored on the post.
const toForumPost = (
  post: StoredPost,
  users: readonly StoredUser[],
  userId: string,
  viewerPinnedPostId: string | null,
): ForumPost => ({
  author: toAuthorRef(users, post.authorId),
  createdAt: post.createdAt,
  editedAt: post.editedAt,
  excerpt: post.excerpt,
  forum: post.forum,
  id: post.id,
  liked: post.likedBy.includes(userId),
  likes: post.likes,
  media: post.media,
  pinned: post.id === viewerPinnedPostId,
  replies: post.replies,
  title: post.title,
});

const byPinnedThenNewest =
  (viewerPinnedPostId: string | null) =>
  (a: StoredPost, b: StoredPost): number => {
    const aPinned = a.id === viewerPinnedPostId;
    const bPinned = b.id === viewerPinnedPostId;
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  };

function listPostsMemory(userId: string, forum?: string): readonly ForumPost[] {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const viewerPinnedPostId = viewer?.pinnedPostId ?? null;
  const filtered = state.posts
    .filter((post) => !forum || forum === 'All' || post.forum === forum)
    .filter((post) => !mutedUserIds.has(post.authorId));
  return [...filtered]
    .sort(byPinnedThenNewest(viewerPinnedPostId))
    .map((post) => toForumPost(post, state.users, userId, viewerPinnedPostId));
}

// Scoped to posts the caller authored — bounded by one user's own activity
// rather than the whole forum feed (unlike listPostsMemory, which every
// screen but the activity hub needs).
function getMyPostsMemory(
  userId: string,
  limit: number,
  cursor: string | null,
): MyPostsPage {
  const state = getState();
  const viewerPinnedPostId =
    state.users.find((user) => user.id === userId)?.pinnedPostId ?? null;
  const mine = state.posts
    .filter((post) => post.authorId === userId)
    .map((post) => ({ id: post.id, post, sortKey: post.createdAt }));
  const page = paginateInMemory(mine, limit, cursor);

  return {
    nextCursor: page.nextCursor,
    posts: page.items.map((item) =>
      toForumPost(item.post, state.users, userId, viewerPinnedPostId),
    ),
  };
}

// Fetches specific posts by id, in no particular guaranteed order — used to
// hydrate bookmarks, which can point at any post regardless of author/forum.
// Applies the same muted-author filter listPostsMemory does: mute is the
// app's one visibility rule, so a muted author's post should stay hidden
// even if it was bookmarked before the mute happened.
function getPostsByIdsMemory(
  userId: string,
  ids: readonly string[],
): readonly ForumPost[] {
  const state = getState();
  const idSet = new Set(ids);
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const viewerPinnedPostId = viewer?.pinnedPostId ?? null;
  return state.posts
    .filter((post) => idSet.has(post.id) && !mutedUserIds.has(post.authorId))
    .map((post) => toForumPost(post, state.users, userId, viewerPinnedPostId));
}

// WHY: seed timestamps are anchored at SEED_NOW_ISO, which may be ahead of
// wall-clock time; clamping keeps newly created posts sorting as newest.
const createdAtNow = (): string =>
  new Date(Math.max(Date.now(), Date.parse(SEED_NOW_ISO))).toISOString();

function createPostMemory(userId: string, input: unknown): CreatePostResult {
  const validation = validatePostInput(input, getState().subforums);
  if (!validation.ok) {
    return validation;
  }
  const mediaUploads = extractMediaUploads(input);

  const stored: StoredPost = {
    authorId: userId,
    createdAt: createdAtNow(),
    editedAt: null,
    excerpt: validation.value.excerpt,
    forum: validation.value.forum,
    id: `post-${crypto.randomUUID()}`,
    likedBy: [],
    likes: 0,
    media: mediaUploads.length
      ? mediaUploads.map((upload) => ({
          filename: upload.filename,
          url: upload.dataUrl,
        }))
      : undefined,
    replies: 0,
    title: validation.value.title,
  };
  const next = setState((current) => ({
    ...current,
    posts: [stored, ...current.posts],
  }));
  const viewerPinnedPostId =
    next.users.find((user) => user.id === userId)?.pinnedPostId ?? null;
  return { ok: true, post: toForumPost(stored, next.users, userId, viewerPinnedPostId) };
}

function toggleLikeMemory(userId: string, postId: string): LikeResult | null {
  const existing = getState().posts.find((post) => post.id === postId);
  if (!existing) {
    return null;
  }
  const wasLiked = existing.likedBy.includes(userId);
  const likes = Math.max(0, existing.likes + (wasLiked ? -1 : 1));
  const likedBy = wasLiked
    ? existing.likedBy.filter((id) => id !== userId)
    : [...existing.likedBy, userId];
  const next = setState((current) => ({
    ...current,
    posts: current.posts.map((post) =>
      post.id === postId ? { ...post, likedBy, likes } : post,
    ),
  }));
  // WHY: mirrors the Supabase `notify_post_liker` trigger — only notify on a
  // new like (not on unlike), and never notify yourself.
  if (!wasLiked && existing.authorId !== userId) {
    const liker = next.users.find((candidate) => candidate.id === userId);
    createNotificationMemory(
      existing.authorId,
      'like',
      'New like on your post',
      `${liker?.name ?? 'Someone'} liked "${existing.title}"`,
      { postId },
    );
  }
  return { id: postId, liked: !wasLiked, likes };
}

// Pinning is a Twitter/Telegram-style personal pin: any signed-in member can
// pin any post (not just their own, unlike edit/delete below), but it's
// exclusive and private to them — at most one pinned post per user, stored
// on StoredUser.pinnedPostId, and it never affects what any other user sees.
function togglePinMemory(userId: string, postId: string): TogglePinResult {
  const existing = getState().posts.find((post) => post.id === postId);
  if (!existing) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  const viewer = getState().users.find((user) => user.id === userId);
  const pinned = viewer?.pinnedPostId !== postId;
  setState((current) => ({
    ...current,
    users: current.users.map((user) =>
      user.id === userId
        ? { ...user, pinnedPostId: pinned ? postId : null }
        : user,
    ),
  }));
  return { id: postId, ok: true, pinned };
}

function deletePostMemory(userId: string, postId: string): boolean {
  const existing = getState().posts.find(
    (post) => post.id === postId && post.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => {
    const removedCommentIds = new Set(
      current.comments
        .filter((comment) => comment.postId === postId)
        .map((comment) => comment.id),
    );
    return {
      ...current,
      commentReports: current.commentReports.filter(
        (report) => !removedCommentIds.has(report.commentId),
      ),
      comments: current.comments.filter((comment) => comment.postId !== postId),
      postReports: current.postReports.filter(
        (report) => report.postId !== postId,
      ),
      posts: current.posts.filter((post) => post.id !== postId),
    };
  });
  return true;
}

function updatePostMemory(
  userId: string,
  postId: string,
  input: unknown,
): UpdatePostResult {
  const existing = getState().posts.find((post) => post.id === postId);
  if (!existing) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  if (existing.authorId !== userId) {
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
    getState().subforums,
  );
  if (!validation.ok) {
    return validation;
  }
  const keptMedia = extractExistingMedia(input);
  const newMedia = extractMediaUploads(input);
  const media = [
    ...keptMedia,
    ...newMedia.map((upload) => ({
      filename: upload.filename,
      url: upload.dataUrl,
    })),
  ];
  const next = setState((current) => ({
    ...current,
    posts: current.posts.map((post) =>
      post.id === postId
        ? {
            ...post,
            editedAt: new Date().toISOString(),
            excerpt: validation.value.excerpt,
            forum: validation.value.forum,
            media: media.length ? media : undefined,
            title: validation.value.title,
          }
        : post,
    ),
  }));
  const updated = next.posts.find((post) => post.id === postId);
  if (!updated) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }
  const viewerPinnedPostId =
    next.users.find((user) => user.id === userId)?.pinnedPostId ?? null;
  return { ok: true, post: toForumPost(updated, next.users, userId, viewerPinnedPostId) };
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function listPosts(
  ctx: RequestContext,
  forum?: string,
): Promise<readonly ForumPost[]> {
  return ctx.supabase
    ? listPostsSupabase(ctx.supabase, ctx.userId, forum)
    : listPostsMemory(ctx.userId, forum);
}

export async function getMyPosts(
  ctx: RequestContext,
  options?: MyPostsOptions,
): Promise<MyPostsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_MY_POSTS_PAGE_SIZE),
    MAX_MY_POSTS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? getMyPostsSupabase(ctx.supabase, ctx.userId, limit, cursor)
    : getMyPostsMemory(ctx.userId, limit, cursor);
}

export async function getPostsByIds(
  ctx: RequestContext,
  ids: readonly string[],
): Promise<readonly ForumPost[]> {
  if (ids.length === 0) {
    return [];
  }
  return ctx.supabase
    ? getPostsByIdsSupabase(ctx.supabase, ctx.userId, ids)
    : getPostsByIdsMemory(ctx.userId, ids);
}

export async function createPost(
  ctx: RequestContext,
  input: unknown,
): Promise<CreatePostResult> {
  return ctx.supabase
    ? createPostSupabase(ctx.supabase, ctx.userId, input)
    : createPostMemory(ctx.userId, input);
}

export async function toggleLike(
  ctx: RequestContext,
  postId: string,
): Promise<LikeResult | null> {
  return ctx.supabase
    ? toggleLikeSupabase(ctx.supabase, ctx.userId, postId)
    : toggleLikeMemory(ctx.userId, postId);
}

export async function togglePin(
  ctx: RequestContext,
  postId: string,
): Promise<TogglePinResult> {
  return ctx.supabase
    ? togglePinSupabase(ctx.supabase, ctx.userId, postId)
    : togglePinMemory(ctx.userId, postId);
}

export async function deletePost(
  ctx: RequestContext,
  postId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deletePostSupabase(ctx.supabase, ctx.userId, postId)
    : deletePostMemory(ctx.userId, postId);
}

export async function updatePost(
  ctx: RequestContext,
  postId: string,
  input: unknown,
): Promise<UpdatePostResult> {
  return ctx.supabase
    ? updatePostSupabase(ctx.supabase, ctx.userId, postId, input)
    : updatePostMemory(ctx.userId, postId, input);
}

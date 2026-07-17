import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  SEED_NOW_ISO,
  setState,
  type StoredPost,
  type StoredUser,
} from '@/src/backend/store';

import {
  createPostSupabase,
  deletePostSupabase,
  listPostsSupabase,
  toggleLikeSupabase,
  updatePostSupabase,
} from './posts-supabase';
import type {
  CreatePostResult,
  ForumPost,
  LikeResult,
  PersonRef,
  UpdatePostResult,
} from './types';
import {
  extractExistingMedia,
  extractMediaUploads,
  validatePostInput,
} from './validation';

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

const toForumPost = (
  post: StoredPost,
  users: readonly StoredUser[],
  userId: string,
): ForumPost => ({
  author: toAuthorRef(users, post.authorId),
  createdAt: post.createdAt,
  excerpt: post.excerpt,
  forum: post.forum,
  id: post.id,
  liked: post.likedBy.includes(userId),
  likes: post.likes,
  media: post.media,
  pinned: post.pinned,
  replies: post.replies,
  title: post.title,
});

const byPinnedThenNewest = (a: StoredPost, b: StoredPost): number => {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
};

function listPostsMemory(userId: string, forum?: string): readonly ForumPost[] {
  const state = getState();
  const mutedUserIds = new Set(
    state.users.find((user) => user.id === userId)?.mutedUserIds ?? [],
  );
  const filtered = state.posts
    .filter((post) => !forum || forum === 'All' || post.forum === forum)
    .filter((post) => !mutedUserIds.has(post.authorId));
  return [...filtered]
    .sort(byPinnedThenNewest)
    .map((post) => toForumPost(post, state.users, userId));
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
    pinned: false,
    replies: 0,
    title: validation.value.title,
  };
  const next = setState((current) => ({
    ...current,
    posts: [stored, ...current.posts],
  }));
  return { ok: true, post: toForumPost(stored, next.users, userId) };
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
  setState((current) => ({
    ...current,
    posts: current.posts.map((post) =>
      post.id === postId ? { ...post, likedBy, likes } : post,
    ),
  }));
  return { id: postId, liked: !wasLiked, likes };
}

function deletePostMemory(userId: string, postId: string): boolean {
  const existing = getState().posts.find(
    (post) => post.id === postId && post.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    comments: current.comments.filter((comment) => comment.postId !== postId),
    posts: current.posts.filter((post) => post.id !== postId),
  }));
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
  const validation = validatePostInput(
    { excerpt: raw.excerpt, forum: existing.forum, title: raw.title },
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
            excerpt: validation.value.excerpt,
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
  return { ok: true, post: toForumPost(updated, next.users, userId) };
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

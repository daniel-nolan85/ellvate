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
  listPostsSupabase,
  toggleLikeSupabase,
} from './posts-supabase';
import type { CreatePostResult, ForumPost, LikeResult, PersonRef } from './types';
import { validatePostInput } from './validation';

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const toAuthorRef = (
  users: readonly StoredUser[],
  authorId: string,
): PersonRef => {
  const user = users.find((candidate) => candidate.id === authorId);
  return user ? { id: user.id, name: user.name } : { id: authorId, name: 'You' };
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
  const filtered =
    !forum || forum === 'All'
      ? state.posts
      : state.posts.filter((post) => post.forum === forum);
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

  const stored: StoredPost = {
    authorId: userId,
    createdAt: createdAtNow(),
    excerpt: validation.value.excerpt,
    forum: validation.value.forum,
    id: `post-${crypto.randomUUID()}`,
    likedBy: [],
    likes: 0,
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

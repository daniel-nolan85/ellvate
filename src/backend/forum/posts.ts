import {
  getState,
  SEED_NOW_ISO,
  setState,
  type StoredPost,
  type StoredUser,
} from '@/src/backend/store';

import type {
  CreatePostResult,
  ForumPost,
  LikeResult,
  PersonRef,
} from './types';

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
  id: post.id,
  forum: post.forum,
  author: toAuthorRef(users, post.authorId),
  createdAt: post.createdAt,
  title: post.title,
  excerpt: post.excerpt,
  replies: post.replies,
  likes: post.likes,
  liked: post.likedBy.includes(userId),
  pinned: post.pinned,
});

const byPinnedThenNewest = (a: StoredPost, b: StoredPost): number => {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
};

export function listPosts(
  userId: string,
  forum?: string,
): readonly ForumPost[] {
  const state = getState();
  const filtered =
    !forum || forum === 'All'
      ? state.posts
      : state.posts.filter((post) => post.forum === forum);

  return [...filtered]
    .sort(byPinnedThenNewest)
    .map((post) => toForumPost(post, state.users, userId));
}

const MAX_TITLE_LENGTH = 140;
const MAX_EXCERPT_LENGTH = 600;
const MAX_FORUM_LENGTH = 60;

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

// WHY: seed timestamps are anchored at SEED_NOW_ISO, which may be ahead of
// wall-clock time; clamping keeps newly created posts sorting as newest.
const createdAtNow = (): string =>
  new Date(Math.max(Date.now(), Date.parse(SEED_NOW_ISO))).toISOString();

export function createPost(userId: string, input: unknown): CreatePostResult {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const forum = asTrimmedString(raw.forum);
  const title = asTrimmedString(raw.title);
  const excerpt = asTrimmedString(raw.excerpt);

  if (!forum || !title) {
    return {
      ok: false,
      code: 'invalid_post',
      message: 'A non-empty forum and title are required.',
    };
  }

  if (
    forum.length > MAX_FORUM_LENGTH ||
    title.length > MAX_TITLE_LENGTH ||
    excerpt.length > MAX_EXCERPT_LENGTH
  ) {
    return {
      ok: false,
      code: 'invalid_post',
      message: 'A post field exceeds its maximum length.',
    };
  }

  const knownForum =
    forum === 'All' || getState().subforums.includes(forum);
  if (!knownForum) {
    return {
      ok: false,
      code: 'invalid_post',
      message: 'Unknown forum.',
    };
  }

  const stored: StoredPost = {
    id: `post-${crypto.randomUUID()}`,
    forum,
    authorId: userId,
    createdAt: createdAtNow(),
    title,
    excerpt,
    replies: 0,
    likes: 0,
    likedBy: [],
    pinned: false,
  };

  const next = setState((current) => ({
    ...current,
    posts: [stored, ...current.posts],
  }));

  return { ok: true, post: toForumPost(stored, next.users, userId) };
}

export function toggleLike(userId: string, postId: string): LikeResult | null {
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
      post.id === postId ? { ...post, likes, likedBy } : post,
    ),
  }));

  return { id: postId, likes, liked: !wasLiked };
}

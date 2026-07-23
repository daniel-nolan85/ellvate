import { getEventsByIds } from '@/src/backend/events';
import { getPostsByIds } from '@/src/backend/forum';
import type { RequestContext } from '@/src/backend/http';
import { getMissionsByIds } from '@/src/backend/missions';
import {
  getState,
  setState,
  type BookmarkTargetType,
  type StoredBookmark,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  listBookmarkIdsSupabase,
  listBookmarksSupabase,
  toggleBookmarkSupabase,
} from './bookmarks-supabase';
import type {
  BookmarkedItem,
  BookmarkIdEntry,
  BookmarksPage,
  ListBookmarksOptions,
  ToggleBookmarkResult,
} from './types';

export const DEFAULT_BOOKMARKS_PAGE_SIZE = 20;
export const MAX_BOOKMARKS_PAGE_SIZE = 50;
// A generous cap on the lightweight ids-only lookup (used to render the
// bookmark icon's filled/outline state on cards) — not a real pagination
// limit, just a backstop against an unbounded fetch for a runaway account.
export const MAX_BOOKMARK_IDS = 1000;

const TARGET_TYPES: readonly BookmarkTargetType[] = ['post', 'event', 'mission'];

const isBookmarkTargetType = (value: unknown): value is BookmarkTargetType =>
  typeof value === 'string' && (TARGET_TYPES as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

function targetExistsMemory(targetType: BookmarkTargetType, targetId: string): boolean {
  const state = getState();
  switch (targetType) {
    case 'post':
      return state.posts.some((post) => post.id === targetId);
    case 'event':
      return state.events.some((event) => event.id === targetId);
    case 'mission':
      return state.missions.some((mission) => mission.id === targetId);
  }
}

function toggleBookmarkMemory(
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string,
): boolean {
  const existing = getState().bookmarks.find(
    (bookmark) =>
      bookmark.userId === userId &&
      bookmark.targetType === targetType &&
      bookmark.targetId === targetId,
  );

  if (existing) {
    setState((current) => ({
      ...current,
      bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== existing.id),
    }));
    return false;
  }

  const stored: StoredBookmark = {
    createdAt: new Date().toISOString(),
    id: `bookmark-${crypto.randomUUID()}`,
    targetId,
    targetType,
    userId,
  };
  setState((current) => ({
    ...current,
    bookmarks: [...current.bookmarks, stored],
  }));
  return true;
}

function listBookmarkRecordsMemory(
  userId: string,
  limit: number,
  cursor: string | null,
  targetType: BookmarkTargetType | undefined,
): { readonly records: readonly StoredBookmark[]; readonly nextCursor: string | null } {
  const mine = getState()
    .bookmarks.filter(
      (bookmark) =>
        bookmark.userId === userId &&
        (!targetType || bookmark.targetType === targetType),
    )
    .map((bookmark) => ({
      bookmark,
      id: bookmark.id,
      sortKey: bookmark.createdAt,
    }));
  const page = paginateInMemory(mine, limit, cursor);
  return {
    nextCursor: page.nextCursor,
    records: page.items.map((item) => item.bookmark),
  };
}

function listBookmarkIdsMemory(userId: string): readonly BookmarkIdEntry[] {
  return getState()
    .bookmarks.filter((bookmark) => bookmark.userId === userId)
    .slice(0, MAX_BOOKMARK_IDS)
    .map((bookmark) => ({
      targetId: bookmark.targetId,
      targetType: bookmark.targetType,
    }));
}

// ---------------------------------------------------------------------------
// Hydration (shared across memory/Supabase — composes the already-dispatched
// getPostsByIds/getEventsByIds/getMissionsByIds, so this logic isn't
// duplicated per backend). Bookmarks whose target has since been deleted are
// silently dropped rather than surfaced as broken rows.
// ---------------------------------------------------------------------------

async function hydrateBookmarks(
  ctx: RequestContext,
  records: readonly StoredBookmark[],
): Promise<readonly BookmarkedItem[]> {
  const idsFor = (targetType: BookmarkTargetType): readonly string[] =>
    records
      .filter((record) => record.targetType === targetType)
      .map((record) => record.targetId);

  const [posts, events, missions] = await Promise.all([
    getPostsByIds(ctx, idsFor('post')),
    getEventsByIds(ctx, idsFor('event')),
    getMissionsByIds(ctx, idsFor('mission')),
  ]);
  const postById = new Map(posts.map((post) => [post.id, post]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));

  return records.flatMap((record): readonly BookmarkedItem[] => {
    if (record.targetType === 'post') {
      const post = postById.get(record.targetId);
      return post
        ? [{ bookmarkedAt: record.createdAt, bookmarkId: record.id, kind: 'post', post }]
        : [];
    }
    if (record.targetType === 'event') {
      const event = eventById.get(record.targetId);
      return event
        ? [{ bookmarkedAt: record.createdAt, bookmarkId: record.id, event, kind: 'event' }]
        : [];
    }
    const mission = missionById.get(record.targetId);
    return mission
      ? [{ bookmarkedAt: record.createdAt, bookmarkId: record.id, kind: 'mission', mission }]
      : [];
  });
}

// Confirms the bookmark target still exists before allowing a bookmark to be
// created — reuses the same getPostsByIds/getEventsByIds/getMissionsByIds
// dispatch functions the hydration step uses, rather than a separate query.
async function targetExists(
  ctx: RequestContext,
  targetType: BookmarkTargetType,
  targetId: string,
): Promise<boolean> {
  if (!ctx.supabase) {
    return targetExistsMemory(targetType, targetId);
  }
  switch (targetType) {
    case 'post':
      return (await getPostsByIds(ctx, [targetId])).length > 0;
    case 'event':
      return (await getEventsByIds(ctx, [targetId])).length > 0;
    case 'mission':
      return (await getMissionsByIds(ctx, [targetId])).length > 0;
  }
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function toggleBookmark(
  ctx: RequestContext,
  input: unknown,
): Promise<ToggleBookmarkResult> {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const targetType = raw.targetType;
  const targetId = raw.targetId;
  if (!isBookmarkTargetType(targetType) || typeof targetId !== 'string' || !targetId) {
    return {
      code: 'invalid_target',
      message: 'targetType must be one of post, event, mission and targetId is required.',
      ok: false,
    };
  }

  if (!(await targetExists(ctx, targetType, targetId))) {
    return { code: 'target_not_found', message: 'That item no longer exists.', ok: false };
  }

  const bookmarked = ctx.supabase
    ? await toggleBookmarkSupabase(ctx.supabase, ctx.userId, targetType, targetId)
    : toggleBookmarkMemory(ctx.userId, targetType, targetId);
  return { bookmarked, ok: true };
}

export async function listBookmarks(
  ctx: RequestContext,
  options?: ListBookmarksOptions,
): Promise<BookmarksPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_BOOKMARKS_PAGE_SIZE),
    MAX_BOOKMARKS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  const targetType = options?.targetType;

  const { records, nextCursor } = ctx.supabase
    ? await listBookmarksSupabase(ctx.supabase, ctx.userId, limit, cursor, targetType)
    : listBookmarkRecordsMemory(ctx.userId, limit, cursor, targetType);

  return { items: await hydrateBookmarks(ctx, records), nextCursor };
}

export async function listBookmarkIds(
  ctx: RequestContext,
): Promise<readonly BookmarkIdEntry[]> {
  return ctx.supabase
    ? listBookmarkIdsSupabase(ctx.supabase, ctx.userId, MAX_BOOKMARK_IDS)
    : listBookmarkIdsMemory(ctx.userId);
}

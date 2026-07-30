import { getEventsByIds } from '@/src/backend/events';
import { getPostsByIds } from '@/src/backend/forum';
import type { RequestContext } from '@/src/backend/http';
import { getMissionsByIds } from '@/src/backend/missions';
import { getServicesByIds } from '@/src/backend/services';
import {
  getState,
  setState,
  type BookmarkTargetType,
  type StoredBookmark,
} from '@/src/backend/store';
import { encodeCursor, paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  BookmarkTargetNotFoundError,
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

const TARGET_TYPES: readonly BookmarkTargetType[] = [
  'post',
  'event',
  'mission',
  'service',
];

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
    case 'service':
      return state.serviceListings.some((listing) => listing.id === targetId);
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

// Returns every one of the caller's bookmark ids, unbounded — this drives
// useIsBookmarked's card-icon state, and a display-only cap here would mean
// an older bookmark reports as "not saved", so its Save/Remove toggle would
// silently delete the real row instead of adding a duplicate. Cheap id pairs,
// so this mirrors the same unbounded shape likedPostIds already uses.
function listBookmarkIdsMemory(userId: string): readonly BookmarkIdEntry[] {
  return getState()
    .bookmarks.filter((bookmark) => bookmark.userId === userId)
    .map((bookmark) => ({
      targetId: bookmark.targetId,
      targetType: bookmark.targetType,
    }));
}

// ---------------------------------------------------------------------------
// Hydration (shared across memory/Supabase — composes the already-dispatched
// getPostsByIds/getEventsByIds/getMissionsByIds, so this logic isn't
// duplicated per backend). Bookmarks whose target has since been deleted are
// silently dropped rather than surfaced as broken rows. Each hydrated item is
// paired with its source record so listBookmarks can compute a correct
// cursor even after dropping some records and/or truncating to the page size.
// ---------------------------------------------------------------------------

interface HydratedBookmark {
  readonly item: BookmarkedItem;
  readonly record: StoredBookmark;
}

async function hydrateBookmarks(
  ctx: RequestContext,
  records: readonly StoredBookmark[],
): Promise<readonly HydratedBookmark[]> {
  const idsFor = (targetType: BookmarkTargetType): readonly string[] =>
    records
      .filter((record) => record.targetType === targetType)
      .map((record) => record.targetId);

  const [posts, events, missions, services] = await Promise.all([
    getPostsByIds(ctx, idsFor('post')),
    getEventsByIds(ctx, idsFor('event')),
    getMissionsByIds(ctx, idsFor('mission')),
    getServicesByIds(ctx, idsFor('service')),
  ]);
  const postById = new Map(posts.map((post) => [post.id, post]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));
  const serviceById = new Map(services.map((listing) => [listing.id, listing]));

  return records.flatMap((record): readonly HydratedBookmark[] => {
    if (record.targetType === 'post') {
      const post = postById.get(record.targetId);
      return post
        ? [
            {
              item: { bookmarkedAt: record.createdAt, bookmarkId: record.id, kind: 'post', post },
              record,
            },
          ]
        : [];
    }
    if (record.targetType === 'event') {
      const event = eventById.get(record.targetId);
      return event
        ? [
            {
              item: { bookmarkedAt: record.createdAt, bookmarkId: record.id, event, kind: 'event' },
              record,
            },
          ]
        : [];
    }
    if (record.targetType === 'mission') {
      const mission = missionById.get(record.targetId);
      return mission
        ? [
            {
              item: { bookmarkedAt: record.createdAt, bookmarkId: record.id, kind: 'mission', mission },
              record,
            },
          ]
        : [];
    }
    const listing = serviceById.get(record.targetId);
    return listing
      ? [
          {
            item: { bookmarkedAt: record.createdAt, bookmarkId: record.id, kind: 'service', listing },
            record,
          },
        ]
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
    case 'service':
      return (await getServicesByIds(ctx, [targetId])).length > 0;
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
      message: 'targetType must be one of post, event, mission, service and targetId is required.',
      ok: false,
    };
  }

  if (!(await targetExists(ctx, targetType, targetId))) {
    return { code: 'target_not_found', message: 'That item no longer exists.', ok: false };
  }

  try {
    const bookmarked = ctx.supabase
      ? await toggleBookmarkSupabase(ctx.supabase, ctx.userId, targetType, targetId)
      : toggleBookmarkMemory(ctx.userId, targetType, targetId);
    return { bookmarked, ok: true };
  } catch (error) {
    // Narrow race: the target was deleted between the targetExists() check
    // above and the atomic toggle itself running.
    if (error instanceof BookmarkTargetNotFoundError) {
      return { code: 'target_not_found', message: 'That item no longer exists.', ok: false };
    }
    throw error;
  }
}

export async function listBookmarks(
  ctx: RequestContext,
  options?: ListBookmarksOptions,
): Promise<BookmarksPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_BOOKMARKS_PAGE_SIZE),
    MAX_BOOKMARKS_PAGE_SIZE,
  );
  const targetType = options?.targetType;

  const collected: HydratedBookmark[] = [];
  let cursor = options?.cursor ?? null;
  let exhausted = false;

  // Hydration drops bookmarks whose target has since been deleted, which can
  // leave an entire raw page empty after filtering even though valid
  // bookmarks exist further on. Keep pulling raw pages until this page is
  // full or the underlying list is exhausted, rather than ever returning a
  // spurious empty page alongside a live cursor — that would strand any
  // bookmarks past a run of orphans, with no way to reach or clear them
  // (BookmarksScreen treats an empty page as the terminal empty state, and
  // toggleBookmark already rejects re-toggling a deleted target).
  while (collected.length < limit && !exhausted) {
    const { records, nextCursor: rawNextCursor } = ctx.supabase
      ? await listBookmarksSupabase(ctx.supabase, ctx.userId, limit, cursor, targetType)
      : listBookmarkRecordsMemory(ctx.userId, limit, cursor, targetType);

    collected.push(...(await hydrateBookmarks(ctx, records)));
    cursor = rawNextCursor;
    exhausted = rawNextCursor === null;
  }

  const page = collected.slice(0, limit);
  const truncated = page.length < collected.length;
  const lastIncluded = page[page.length - 1];
  const nextCursor = truncated
    ? lastIncluded
      ? encodeCursor({ id: lastIncluded.record.id, sortKey: lastIncluded.record.createdAt })
      : null
    : exhausted
      ? null
      : cursor;

  return { items: page.map((entry) => entry.item), nextCursor };
}

export async function listBookmarkIds(
  ctx: RequestContext,
): Promise<readonly BookmarkIdEntry[]> {
  return ctx.supabase
    ? listBookmarkIdsSupabase(ctx.supabase, ctx.userId)
    : listBookmarkIdsMemory(ctx.userId);
}

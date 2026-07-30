import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getBookmarks } from '../../app/api/bookmarks+api';
import { GET as getBookmarkIds } from '../../app/api/bookmarks/ids+api';
import { POST as postToggleBookmark } from '../../app/api/bookmarks/toggle+api';
import { listBookmarkIds, listBookmarks, toggleBookmark } from '../../src/backend/bookmarks';
import { deleteEvent } from '../../src/backend/events';
import { createPost, deletePost } from '../../src/backend/forum';
import { memoryContext } from '../../src/backend/http';
import { deleteMission } from '../../src/backend/missions';
import { toggleMute } from '../../src/backend/mutes';
import { deleteServiceListing } from '../../src/backend/services';
import {
  DEMO_USER_ID,
  resetStore,
  setState,
  type StoredBookmark,
} from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('toggleBookmark', () => {
  test('adds a bookmark for a valid post target', async () => {
    const result = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: 'post-1',
      targetType: 'post',
    });
    expect(result).toEqual({ bookmarked: true, ok: true });

    const page = await listBookmarks(ctx(DEMO_USER_ID));
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ kind: 'post' });
  });

  test('removes the bookmark on a second toggle', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });
    const result = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: 'post-1',
      targetType: 'post',
    });
    expect(result).toEqual({ bookmarked: false, ok: true });
    expect((await listBookmarks(ctx(DEMO_USER_ID))).items).toEqual([]);
  });

  test('rejects an invalid targetType', async () => {
    const result = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: 'post-1',
      targetType: 'not-a-real-type',
    });
    expect(result).toMatchObject({ code: 'invalid_target', ok: false });
  });

  test('rejects a missing targetId', async () => {
    const result = await toggleBookmark(ctx(DEMO_USER_ID), { targetType: 'post' });
    expect(result).toMatchObject({ code: 'invalid_target', ok: false });
  });

  test('rejects a target that does not exist', async () => {
    const result = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: 'post-does-not-exist',
      targetType: 'post',
    });
    expect(result).toMatchObject({ code: 'target_not_found', ok: false });
  });

  test('allows bookmarking events, missions, and service listings as well as posts', async () => {
    const event = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: 'event-1',
      targetType: 'event',
    });
    expect(event).toEqual({ bookmarked: true, ok: true });

    const mission = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: 'mission-1',
      targetType: 'mission',
    });
    expect(mission).toEqual({ bookmarked: true, ok: true });

    const service = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: 'service-1',
      targetType: 'service',
    });
    expect(service).toEqual({ bookmarked: true, ok: true });

    const page = await listBookmarks(ctx(DEMO_USER_ID));
    expect(page.items.map((item) => item.kind).sort()).toEqual([
      'event',
      'mission',
      'service',
    ]);
  });

  test('allows bookmarking content the caller authored themselves', async () => {
    // post-1 is authored by user-jordan (seeded) — bookmarking your own
    // content is intentionally allowed, no extra ownership check.
    const result = await toggleBookmark(ctx('user-jordan'), {
      targetId: 'post-1',
      targetType: 'post',
    });
    expect(result).toEqual({ bookmarked: true, ok: true });
  });
});

describe('listBookmarks', () => {
  test('only returns the caller\'s own bookmarks', async () => {
    await toggleBookmark(ctx('user-mia'), { targetId: 'post-1', targetType: 'post' });

    expect((await listBookmarks(ctx(DEMO_USER_ID))).items).toEqual([]);
    expect((await listBookmarks(ctx('user-mia'))).items).toHaveLength(1);
  });

  test('returns newest first', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'event-1', targetType: 'event' });

    const page = await listBookmarks(ctx(DEMO_USER_ID));
    expect(page.items).toHaveLength(2);
    // Two toggles fired back-to-back can land in the same millisecond, so
    // assert non-decreasing order rather than a strict kind ordering.
    expect(
      Date.parse(page.items[0]!.bookmarkedAt),
    ).toBeGreaterThanOrEqual(Date.parse(page.items[1]!.bookmarkedAt));
  });

  test('filters to a single target type when requested', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'event-1', targetType: 'event' });

    const page = await listBookmarks(ctx(DEMO_USER_ID), { targetType: 'event' });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ kind: 'event' });
  });

  test('paginates using limit and cursor', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-2', targetType: 'post' });
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-3', targetType: 'post' });

    const firstPage = await listBookmarks(ctx(DEMO_USER_ID), { limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listBookmarks(ctx(DEMO_USER_ID), {
      cursor: firstPage.nextCursor,
      limit: 2,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('clamps an out-of-range limit to the allowed maximum', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });

    const page = await listBookmarks(ctx(DEMO_USER_ID), { limit: 9999 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  test('silently drops a bookmark whose target has since been deleted', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'event-1', targetType: 'event' });

    // post-1 is authored by user-jordan, event-1 by user-hoa (seeded).
    expect(await deletePost(ctx('user-jordan'), 'post-1')).toBe(true);
    expect(await deleteEvent(ctx('user-hoa'), 'event-1')).toBe(true);

    const page = await listBookmarks(ctx(DEMO_USER_ID));
    expect(page.items).toEqual([]);
  });

  test('drops an orphaned mission bookmark the same way', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'mission-1', targetType: 'mission' });
    // mission-1 is authored by user-hoa (seeded).
    expect(await deleteMission(ctx('user-hoa'), 'mission-1')).toBe(true);

    expect((await listBookmarks(ctx(DEMO_USER_ID))).items).toEqual([]);
  });

  test('drops an orphaned service listing bookmark the same way', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'service-1', targetType: 'service' });
    // service-1 is authored by user-riley (seeded).
    expect(await deleteServiceListing(ctx('user-riley'), 'service-1')).toBe(true);

    expect((await listBookmarks(ctx(DEMO_USER_ID))).items).toEqual([]);
  });

  test('does not strand a valid bookmark behind a full raw page of orphans', async () => {
    // One valid bookmark, older than everything else, followed by 20 more
    // recent bookmarks whose targets no longer exist. A raw page of
    // limit=20 (newest first) is therefore *entirely* orphans, with the one
    // valid bookmark sitting just past it — reproducing the exact failure
    // mode where hydration filters a full page down to nothing even though
    // a real saved item exists.
    const records: StoredBookmark[] = [
      {
        createdAt: '2020-01-01T00:00:00.000Z',
        id: 'bookmark-valid',
        targetId: 'post-1',
        targetType: 'post',
        userId: DEMO_USER_ID,
      },
      ...Array.from({ length: 20 }, (_, index) => ({
        createdAt: `2021-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
        id: `bookmark-orphan-${index}`,
        targetId: `post-orphan-${index}`,
        targetType: 'post' as const,
        userId: DEMO_USER_ID,
      })),
    ];
    setState((current) => ({ ...current, bookmarks: records }));

    const page = await listBookmarks(ctx(DEMO_USER_ID), { limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ bookmarkId: 'bookmark-valid', kind: 'post' });
    expect(page.nextCursor).toBeNull();
  });

  test('truncates an overshot page to a cursor mid-raw-page, not at a page boundary', async () => {
    // 2 orphans + 1 valid (newest, raw page 1 with limit=3) followed by 3
    // more valid bookmarks (raw page 2). Page 1 hydrates to just 1 item, so
    // the loop fetches page 2 too — but page 2 contributes 3 more valid
    // items, overshooting the limit of 3 (1 + 3 = 4 collected). The result
    // must truncate to the 3 newest and produce a cursor pointing at the
    // 3rd item specifically (partway through page 2's raw records), not at
    // page 2's own raw cursor (which would incorrectly skip the 4th item).
    const records: StoredBookmark[] = [
      {
        createdAt: '2021-06-06T00:00:00.000Z',
        id: 'bookmark-orphan-a',
        targetId: 'post-orphan-a',
        targetType: 'post',
        userId: DEMO_USER_ID,
      },
      {
        createdAt: '2021-06-05T00:00:00.000Z',
        id: 'bookmark-orphan-b',
        targetId: 'post-orphan-b',
        targetType: 'post',
        userId: DEMO_USER_ID,
      },
      {
        createdAt: '2021-06-04T00:00:00.000Z',
        id: 'bookmark-valid-1',
        targetId: 'post-1',
        targetType: 'post',
        userId: DEMO_USER_ID,
      },
      {
        createdAt: '2021-06-03T00:00:00.000Z',
        id: 'bookmark-valid-2',
        targetId: 'post-2',
        targetType: 'post',
        userId: DEMO_USER_ID,
      },
      {
        createdAt: '2021-06-02T00:00:00.000Z',
        id: 'bookmark-valid-3',
        targetId: 'post-3',
        targetType: 'post',
        userId: DEMO_USER_ID,
      },
      {
        createdAt: '2021-06-01T00:00:00.000Z',
        id: 'bookmark-valid-4',
        targetId: 'post-4',
        targetType: 'post',
        userId: DEMO_USER_ID,
      },
    ];
    setState((current) => ({ ...current, bookmarks: records }));

    const firstPage = await listBookmarks(ctx(DEMO_USER_ID), { limit: 3 });
    expect(firstPage.items.map((item) => item.bookmarkId)).toEqual([
      'bookmark-valid-1',
      'bookmark-valid-2',
      'bookmark-valid-3',
    ]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listBookmarks(ctx(DEMO_USER_ID), {
      cursor: firstPage.nextCursor,
      limit: 3,
    });
    expect(secondPage.items.map((item) => item.bookmarkId)).toEqual(['bookmark-valid-4']);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('hides a bookmarked post once its author is muted', async () => {
    // post-1 is authored by user-jordan (seeded). Mute is the app's one
    // content-visibility rule, so it must apply to saved content too, not
    // just the main forum feed.
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });
    expect((await listBookmarks(ctx(DEMO_USER_ID))).items).toHaveLength(1);

    await toggleMute(ctx(DEMO_USER_ID), 'user-jordan');

    expect((await listBookmarks(ctx(DEMO_USER_ID))).items).toEqual([]);
  });
});

describe('listBookmarkIds', () => {
  test('returns a lightweight id list scoped to the caller', async () => {
    await toggleBookmark(ctx(DEMO_USER_ID), { targetId: 'post-1', targetType: 'post' });
    await toggleBookmark(ctx('user-mia'), { targetId: 'event-1', targetType: 'event' });

    const ids = await listBookmarkIds(ctx(DEMO_USER_ID));
    expect(ids).toEqual([{ targetId: 'post-1', targetType: 'post' }]);
  });

  test('returns an empty list when nothing is bookmarked', async () => {
    expect(await listBookmarkIds(ctx(DEMO_USER_ID))).toEqual([]);
  });

  test('preserves membership for bookmarks beyond the old 1000-item cap', async () => {
    // A prior cap capped this list at 1000 ids: an older bookmark past that
    // point would report as "not saved" via useIsBookmarked, so pressing its
    // Save/Remove toggle would delete the real row instead of adding a
    // duplicate. There must be no such destructive blind spot.
    const TOTAL = 1001;
    const postIds: string[] = [];
    for (let i = 0; i < TOTAL; i += 1) {
      const created = await createPost(ctx(DEMO_USER_ID), {
        excerpt: 'x',
        forum: 'All',
        title: `Post ${i}`,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      postIds.push(created.post.id);
      await toggleBookmark(ctx(DEMO_USER_ID), {
        targetId: created.post.id,
        targetType: 'post',
      });
    }

    const ids = await listBookmarkIds(ctx(DEMO_USER_ID));
    expect(ids).toHaveLength(TOTAL);

    const oldestPostId = postIds[0]!;
    expect(ids.some((entry) => entry.targetId === oldestPostId)).toBe(true);

    // Toggling the oldest bookmark again must remove it, not silently no-op
    // or add a duplicate — proving the toggle sees it as already bookmarked.
    const toggled = await toggleBookmark(ctx(DEMO_USER_ID), {
      targetId: oldestPostId,
      targetType: 'post',
    });
    expect(toggled).toEqual({ bookmarked: false, ok: true });
    expect(await listBookmarkIds(ctx(DEMO_USER_ID))).toHaveLength(TOTAL - 1);
  }, 20000);
});

describe('bookmark routes', () => {
  test('POST toggle rejects an invalid body with 400', async () => {
    const response = await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'post-1', targetType: 'nonsense' }),
        method: 'POST',
      }),
    );
    expect(response.status).toBe(400);
  });

  test('POST toggle returns 404 for an unknown target', async () => {
    const response = await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'post-nope', targetType: 'post' }),
        method: 'POST',
      }),
    );
    expect(response.status).toBe(404);
  });

  test('POST toggle adds then removes a bookmark end to end', async () => {
    const added = await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'post-1', targetType: 'post' }),
        method: 'POST',
      }),
    );
    expect(added.status).toBe(200);
    expect(await added.json()).toEqual({ bookmarked: true });

    const removed = await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'post-1', targetType: 'post' }),
        method: 'POST',
      }),
    );
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ bookmarked: false });
  });

  test('GET returns a hydrated, bounded page', async () => {
    // Unauthenticated route requests default to DEMO_USER_ID.
    await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'post-1', targetType: 'post' }),
        method: 'POST',
      }),
    );
    await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'event-1', targetType: 'event' }),
        method: 'POST',
      }),
    );

    const response = await getBookmarks(
      new Request('http://localhost/api/bookmarks?limit=1'),
    );
    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      items: readonly { kind: string }[];
      nextCursor: string | null;
    };
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
  });

  test('GET filters by targetType query param', async () => {
    await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'post-1', targetType: 'post' }),
        method: 'POST',
      }),
    );
    await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'event-1', targetType: 'event' }),
        method: 'POST',
      }),
    );

    const response = await getBookmarks(
      new Request('http://localhost/api/bookmarks?targetType=event'),
    );
    const page = (await response.json()) as { items: readonly { kind: string }[] };
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ kind: 'event' });
  });

  test('ids route returns just the lightweight list', async () => {
    await postToggleBookmark(
      new Request('http://localhost/api/bookmarks/toggle', {
        body: JSON.stringify({ targetId: 'post-1', targetType: 'post' }),
        method: 'POST',
      }),
    );

    const response = await getBookmarkIds(
      new Request('http://localhost/api/bookmarks/ids'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ids: readonly { targetId: string; targetType: string }[];
    };
    expect(body.ids).toEqual([{ targetId: 'post-1', targetType: 'post' }]);
  });
});

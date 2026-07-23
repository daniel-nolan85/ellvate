import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getBookmarks } from '../../app/api/bookmarks+api';
import { GET as getBookmarkIds } from '../../app/api/bookmarks/ids+api';
import { POST as postToggleBookmark } from '../../app/api/bookmarks/toggle+api';
import { listBookmarkIds, listBookmarks, toggleBookmark } from '../../src/backend/bookmarks';
import { deleteEvent } from '../../src/backend/events';
import { deletePost } from '../../src/backend/forum';
import { memoryContext } from '../../src/backend/http';
import { deleteMission } from '../../src/backend/missions';
import { DEMO_USER_ID, resetStore } from '../../src/backend/store';

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

  test('allows bookmarking events and missions as well as posts', async () => {
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

    const page = await listBookmarks(ctx(DEMO_USER_ID));
    expect(page.items.map((item) => item.kind).sort()).toEqual(['event', 'mission']);
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

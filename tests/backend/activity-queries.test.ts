import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getMyEventsRoute } from '../../app/api/events/mine+api';
import { GET as getMyPostsRoute } from '../../app/api/forum/posts/mine+api';
import { GET as getMyMissionsRoute } from '../../app/api/missions/mine+api';
import { createEvent, getMyEventsView, toggleJoin } from '../../src/backend/events';
import { createPost, getMyPosts } from '../../src/backend/forum';
import { memoryContext } from '../../src/backend/http';
import { createMission, getMyMissionsView } from '../../src/backend/missions';
import { DEMO_USER_ID, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('getMyPosts', () => {
  test("returns only the caller's own posts, not the whole forum feed", async () => {
    // post-1 is authored by user-jordan (seeded); post-3 by user-mia.
    const jordanPage = await getMyPosts(ctx('user-jordan'));
    expect(jordanPage.posts.map((post) => post.id)).toEqual(['post-1']);

    const miaPage = await getMyPosts(ctx('user-mia'));
    expect(miaPage.posts.map((post) => post.id)).toEqual(['post-3']);

    expect(await getMyPosts(ctx('user-riley'))).toEqual({
      nextCursor: null,
      posts: [],
    });
  });

  test('paginates with a cursor rather than returning everything at once', async () => {
    await createPost(ctx('user-riley'), {
      excerpt: 'First',
      forum: 'All',
      title: 'One',
    });
    await createPost(ctx('user-riley'), {
      excerpt: 'Second',
      forum: 'All',
      title: 'Two',
    });

    const firstPage = await getMyPosts(ctx('user-riley'), { limit: 1 });
    expect(firstPage.posts).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await getMyPosts(ctx('user-riley'), {
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.posts).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();

    const seenIds = new Set(
      [...firstPage.posts, ...secondPage.posts].map((post) => post.id),
    );
    expect(seenIds.size).toBe(2);
  });

  test('route returns a bounded page shape', async () => {
    const response = await getMyPostsRoute(
      new Request('http://localhost/api/forum/posts/mine'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      posts: readonly unknown[];
      nextCursor: string | null;
    };
    expect(Array.isArray(body.posts)).toBe(true);
  });
});

describe('getMyEventsView', () => {
  test('returns events the caller created or joined, not the whole community', async () => {
    // event-1 is created by user-hoa (seeded), with no seeded joins.
    const hoaPage = await getMyEventsView(ctx('user-hoa'));
    expect(hoaPage.events.map((event) => event.id)).toContain('event-1');

    const miaPageBeforeJoin = await getMyEventsView(ctx('user-mia'));
    expect(miaPageBeforeJoin.events.map((event) => event.id)).not.toContain(
      'event-1',
    );

    const joinResult = await toggleJoin(ctx('user-mia'), 'event-1');
    expect(joinResult?.joined).toBe(true);

    const miaPageAfterJoin = await getMyEventsView(ctx('user-mia'));
    const joinedEvent = miaPageAfterJoin.events.find(
      (event) => event.id === 'event-1',
    );
    expect(joinedEvent?.joined).toBe(true);
  });

  test('paginates with a cursor rather than returning the whole community list', async () => {
    const validInput = {
      date: '2026-07-18',
      place: 'Village Marina',
      tag: 'Outdoors',
      time: '18:00',
      title: 'Sunset Kayak',
    };
    await createEvent(ctx('user-riley'), validInput);
    await createEvent(ctx('user-riley'), { ...validInput, title: 'Second' });

    const firstPage = await getMyEventsView(ctx('user-riley'), { limit: 1 });
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await getMyEventsView(ctx('user-riley'), {
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.events).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('route returns a bounded page shape', async () => {
    const response = await getMyEventsRoute(
      new Request('http://localhost/api/events/mine'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      events: readonly unknown[];
      nextCursor: string | null;
    };
    expect(Array.isArray(body.events)).toBe(true);
  });
});

describe('getMyMissionsView', () => {
  test('returns missions the caller created or completed, not the whole community', async () => {
    // Seed: mission-3 is the only one DEMO_USER_ID has completed
    // (status: 'done'); mission-1/2 are still active, mission-4 is locked.
    // All four are authored by user-hoa.
    const demoPage = await getMyMissionsView(ctx(DEMO_USER_ID));
    expect(demoPage.missions.map((mission) => mission.id)).toEqual([
      'mission-3',
    ]);

    const hoaPage = await getMyMissionsView(ctx('user-hoa'));
    expect(new Set(hoaPage.missions.map((mission) => mission.id))).toEqual(
      new Set(['mission-1', 'mission-2', 'mission-3', 'mission-4']),
    );

    expect(await getMyMissionsView(ctx('user-mia'))).toEqual({
      missions: [],
      nextCursor: null,
    });
  });

  test('paginates with a cursor rather than returning the whole community list', async () => {
    const validInput = {
      description: 'Rent a kayak and get on the water.',
      icon: 'Sun',
      scheduledFor: '2026-07-18',
      stopsTotal: 1,
      title: 'One',
      xp: 75,
    };
    await createMission(ctx('user-riley'), validInput);
    await createMission(ctx('user-riley'), { ...validInput, title: 'Two' });

    const firstPage = await getMyMissionsView(ctx('user-riley'), { limit: 1 });
    expect(firstPage.missions).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await getMyMissionsView(ctx('user-riley'), {
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.missions).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('route returns a bounded page shape', async () => {
    const response = await getMyMissionsRoute(
      new Request('http://localhost/api/missions/mine'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      missions: readonly unknown[];
      nextCursor: string | null;
    };
    expect(Array.isArray(body.missions)).toBe(true);
  });
});

import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getDigest } from '../../app/api/digest+api';
import { getWeeklyDigest } from '../../src/backend/digest';
import { memoryContext } from '../../src/backend/http';
import { MISSION_COMPLETION_XP } from '../../src/backend/missions/user-progress';
import {
  DEMO_USER_ID,
  resetStore,
  setState,
  type StoredComment,
  type StoredEvent,
  type StoredMission,
  type StoredPost,
} from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

// A fixed window unrelated to "today", so assertions never depend on when
// the test suite actually runs. WEEK_START is read as a Pacific-local date
// (see week-bounds.ts), so in January (PST, UTC-8) the window is
// [2026-01-05T08:00Z, 2026-01-12T08:00Z) -- AFTER_WEEK sits right on that
// exclusive end boundary.
const WEEK_START = '2026-01-05';
const IN_WEEK = '2026-01-07T12:00:00.000Z';
const BEFORE_WEEK = '2026-01-04T23:59:59.000Z';
const AFTER_WEEK = '2026-01-12T08:00:00.000Z';

function makePost(overrides: Partial<StoredPost> & { readonly id: string }): StoredPost {
  return {
    authorId: 'user-jordan',
    createdAt: IN_WEEK,
    editedAt: null,
    excerpt: 'x',
    forum: 'All',
    likedBy: [],
    likes: 0,
    replies: 0,
    title: 'Untitled',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<StoredEvent> & { readonly id: string }): StoredEvent {
  return {
    attendeeIds: [],
    authorId: 'user-hoa',
    dateLabel: 'Jan 7',
    dayLabel: 'WED',
    editedAt: null,
    featured: false,
    going: 0,
    joinedBy: [],
    place: 'Marina',
    startsAt: IN_WEEK,
    tag: 'Community',
    timeLabel: '6:00 PM',
    title: 'Untitled event',
    ...overrides,
  };
}

function makeMission(
  overrides: Partial<StoredMission> & { readonly id: string },
): StoredMission {
  return {
    authorId: 'user-hoa',
    description: 'x',
    editedAt: null,
    theme: 'social',
    progressByUser: {},
    scheduledFor: null,
    stops: ['Stop 1'],
    stopsTotal: 1,
    title: 'Untitled mission',
    ...overrides,
  };
}

afterEach(() => {
  resetStore();
});

describe('getWeeklyDigest', () => {
  test('counts only content within the requested week', async () => {
    setState((current) => ({
      ...current,
      posts: [
        makePost({ id: 'post-in', createdAt: IN_WEEK }),
        makePost({ id: 'post-before', createdAt: BEFORE_WEEK }),
        makePost({ id: 'post-after', createdAt: AFTER_WEEK }),
      ],
    }));

    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    expect(digest.stats.newPosts).toBe(1);
    expect(digest.popularPosts.map((post) => post.id)).toEqual(['post-in']);
  });

  test('ranks popular posts by likes plus double comments', async () => {
    setState((current) => ({
      ...current,
      posts: [
        makePost({ id: 'post-a', likes: 5, replies: 0 }),
        makePost({ id: 'post-b', likes: 1, replies: 3 }),
        makePost({ id: 'post-c', likes: 0, replies: 0 }),
      ],
    }));

    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    // post-b: 1 + 2*3 = 7, post-a: 5 + 0 = 5, post-c: 0
    expect(digest.popularPosts.map((post) => post.id)).toEqual([
      'post-b',
      'post-a',
      'post-c',
    ]);
  });

  test('ranks popular events by going count', async () => {
    setState((current) => ({
      ...current,
      events: [
        makeEvent({ going: 3, id: 'event-a' }),
        makeEvent({ going: 20, id: 'event-b' }),
        makeEvent({ going: 10, id: 'event-c' }),
      ],
    }));

    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    expect(digest.stats.eventsHeld).toBe(3);
    expect(digest.popularEvents.map((event) => event.id)).toEqual([
      'event-b',
      'event-c',
      'event-a',
    ]);
  });

  test('aggregates missions completed within the week, ignoring other weeks and non-done progress', async () => {
    setState((current) => ({
      ...current,
      missions: [
        makeMission({
          id: 'mission-a',
          progressByUser: {
            'user-mia': { completedAt: IN_WEEK, status: 'done', stopsDone: 1 },
            'user-riley': { completedAt: IN_WEEK, status: 'done', stopsDone: 1 },
            'user-sam': { completedAt: null, status: 'active', stopsDone: 0 },
          },
        }),
        makeMission({
          id: 'mission-b',
          progressByUser: {
            [DEMO_USER_ID]: { completedAt: BEFORE_WEEK, status: 'done', stopsDone: 1 },
          },
        }),
      ],
    }));

    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    expect(digest.stats.missionsCompleted).toBe(2);
    expect(digest.completedMissions).toEqual([
      {
        completedByCount: 2,
        id: 'mission-a',
        title: 'Untitled mission',
        xp: MISSION_COMPLETION_XP,
      },
    ]);
  });

  test('counts distinct active members across posts, events, comments, and completions', async () => {
    const comment: StoredComment = {
      authorId: 'user-riley',
      body: 'nice',
      createdAt: IN_WEEK,
      editedAt: null,
      id: 'comment-1',
      postId: 'post-in',
    };
    setState((current) => ({
      ...current,
      comments: [comment],
      events: [makeEvent({ authorId: 'user-hoa', id: 'event-in' })],
      missions: [
        makeMission({
          id: 'mission-in',
          progressByUser: {
            'user-sam': { completedAt: IN_WEEK, status: 'done', stopsDone: 1 },
          },
        }),
      ],
      posts: [makePost({ authorId: 'user-jordan', id: 'post-in' })],
    }));

    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    expect(digest.stats.activeMembers).toBe(4);
  });

  test('returns an entirely empty digest for a week with no activity', async () => {
    setState((current) => ({ ...current, comments: [], events: [], missions: [], posts: [] }));

    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    expect(digest).toMatchObject({
      completedMissions: [],
      popularEvents: [],
      popularPosts: [],
      stats: { activeMembers: 0, eventsHeld: 0, missionsCompleted: 0, newPosts: 0 },
    });
  });

  test('weekEnd is the inclusive last day of the recapped week', async () => {
    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    expect(digest.weekStart).toBe('2026-01-05');
    expect(digest.weekEnd).toBe('2026-01-11');
  });

  test('hides a popular post from a since-muted author, matching the mute boundary elsewhere', async () => {
    // post-1 is authored by user-jordan (seeded).
    setState((current) => ({
      ...current,
      posts: [makePost({ authorId: 'user-jordan', id: 'post-in', likes: 50 })],
      users: current.users.map((user) =>
        user.id === DEMO_USER_ID ? { ...user, mutedUserIds: ['user-jordan'] } : user,
      ),
    }));

    const digest = await getWeeklyDigest(ctx(DEMO_USER_ID), { weekStart: WEEK_START });
    expect(digest.popularPosts).toEqual([]);
  });

  test('comingUp lists events/missions in the next 7 real days regardless of the recapped week', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const farOut = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const soonDate = soon.slice(0, 10);
    const farOutDate = farOut.slice(0, 10);

    setState((current) => ({
      ...current,
      events: [
        makeEvent({ id: 'event-soon', startsAt: soon, title: 'Soon event' }),
        makeEvent({ id: 'event-far', startsAt: farOut, title: 'Far event' }),
      ],
      missions: [
        makeMission({ id: 'mission-soon', scheduledFor: soonDate, title: 'Soon mission' }),
        makeMission({ id: 'mission-far', scheduledFor: farOutDate, title: 'Far mission' }),
      ],
    }));

    // Deliberately using a stale/old weekStart to prove "coming up" ignores it.
    const digest = await getWeeklyDigest(ctx(), { weekStart: WEEK_START });
    expect(digest.comingUpEvents.map((event) => event.id)).toEqual(['event-soon']);
    expect(digest.comingUpMissions.map((mission) => mission.id)).toEqual(['mission-soon']);
  });

  test('defaults to the most recently completed week when no weekStart is given', async () => {
    const digest = await getWeeklyDigest(ctx());
    expect(digest.weekStart < digest.weekEnd).toBe(true);
  });
});

describe('digest route', () => {
  test('GET returns a digest for an explicit weekStart query param', async () => {
    setState((current) => ({
      ...current,
      posts: [makePost({ id: 'post-in' })],
    }));

    const response = await getDigest(
      new Request(`http://localhost/api/digest?weekStart=${WEEK_START}`),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { weekStart: string; stats: { newPosts: number } };
    expect(body.weekStart).toBe(WEEK_START);
    expect(body.stats.newPosts).toBe(1);
  });

  test('GET defaults to the most recent week without a weekStart param', async () => {
    const response = await getDigest(new Request('http://localhost/api/digest'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { weekStart: string; weekEnd: string };
    expect(typeof body.weekStart).toBe('string');
    expect(typeof body.weekEnd).toBe('string');
  });

  test('GET rejects a malformed weekStart instead of throwing', async () => {
    const response = await getDigest(
      new Request('http://localhost/api/digest?weekStart=not-a-date'),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('invalid_week_start');
  });
});

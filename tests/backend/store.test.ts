import { afterEach, describe, expect, test } from 'bun:test';

import {
  createSeedState,
  DEMO_USER_ID,
  getState,
  resetStore,
  SEED_NOW_ISO,
  setState,
} from '../../src/backend/store';

afterEach(() => {
  resetStore();
});

describe('seed data', () => {
  test('seeds the 7 design subforums starting with All', () => {
    expect(getState().subforums).toEqual([
      'All',
      'Announcements',
      'Marina & Boating',
      'Dining',
      'Trails',
      'Buy & Sell',
      'Events',
    ]);
  });

  test('seeds 4 posts with relative times converted to createdAt offsets', () => {
    const { posts } = getState();
    const seedNowMs = Date.parse(SEED_NOW_ISO);
    const hoursBefore = (iso: string): number =>
      (seedNowMs - Date.parse(iso)) / (60 * 60 * 1000);

    expect(posts).toHaveLength(4);
    expect(posts.map((post) => post.title)).toEqual([
      'Best spots to kayak at sunrise?',
      'Fountain show returns Friday nights',
      'New patio at the waterfront bistro',
      'Loop trail partially closed for repaving',
    ]);
    expect(posts.map((post) => hoursBefore(post.createdAt))).toEqual([
      2, 5, 24, 25,
    ]);
    expect(posts.filter((post) => post.pinned).map((post) => post.id)).toEqual([
      'post-2',
    ]);
    expect(posts.map((post) => post.likes)).toEqual([61, 138, 92, 27]);
    expect(posts.every((post) => post.likedBy.length === 0)).toBe(true);
  });

  test('seeds 4 events with the featured mixer and attendee refs', () => {
    const { events, users } = getState();
    const userIds = new Set(users.map((user) => user.id));

    expect(events).toHaveLength(4);
    expect(events.filter((event) => event.featured).map((e) => e.id)).toEqual([
      'event-1',
    ]);
    expect(events[0]).toMatchObject({
      title: 'Locals Networking Mixer',
      timeLabel: '6:30 PM',
      dayLabel: 'FRI',
      dateLabel: '18',
      place: 'MonteLago Village',
      tag: 'Networking',
      going: 48,
    });
    expect(events.map((event) => event.going)).toEqual([48, 210, 32, 19]);
    expect(events.map((event) => event.attendeeIds.length)).toEqual([
      4, 3, 2, 2,
    ]);
    expect(
      events.every((event) =>
        event.attendeeIds.every((id) => userIds.has(id)),
      ),
    ).toBe(true);
  });

  test('seeds 4 missions with per-user demo progress', () => {
    const { missions } = getState();

    expect(missions).toHaveLength(4);
    expect(missions.map((mission) => mission.stopsTotal)).toEqual([1, 3, 3, 1]);
    expect(missions.map((mission) => mission.xp)).toEqual([50, 120, 90, 40]);
    expect(missions.map((mission) => mission.icon)).toEqual([
      'Sun',
      'ArrowUp',
      'Star',
      'Moon',
    ]);
    expect(
      missions.map((mission) => mission.progressByUser[DEMO_USER_ID]?.status),
    ).toEqual(['active', 'active', 'done', 'locked']);
    expect(
      missions.map(
        (mission) => mission.progressByUser[DEMO_USER_ID]?.stopsDone,
      ),
    ).toEqual([0, 2, 3, 0]);
  });

  test('seeds 6 ranked leaderboard users with You as demo-user', () => {
    const ranked = getState().users.filter(
      (user) => user.missionsCompleted > 0,
    );

    expect(ranked).toHaveLength(6);
    expect(ranked.map((user) => user.name)).toEqual([
      'Mia Lake',
      'Andre King',
      'Jordan Diaz',
      'Priya Rao',
      'Sam Ortiz',
      'You',
    ]);
    expect(ranked.map((user) => user.xp)).toEqual([
      3820, 3540, 3110, 2640, 2190, 1980,
    ]);

    const me = ranked.at(-1);
    expect(me?.id).toBe(DEMO_USER_ID);
    expect(me?.missionsCompleted).toBe(21);
    expect(me?.streakDays).toBe(12);
    expect(me?.title).toBe('LAKE EXPLORER');
  });

  test('seeds the MON 14 to SUN 20 week strip with FRI 18 today', () => {
    const { week } = getState();

    expect(week.map((day) => `${day.dayLabel} ${day.dateLabel}`)).toEqual([
      'MON 14',
      'TUE 15',
      'WED 16',
      'THU 17',
      'FRI 18',
      'SAT 19',
      'SUN 20',
    ]);
    expect(week.map((day) => day.date)).toEqual([
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
    ]);
    expect(week.filter((day) => day.isToday).map((d) => d.dayLabel)).toEqual([
      'FRI',
    ]);
  });

  test('demo-user profile starts un-onboarded with default notification prefs', () => {
    const me = getState().users.find((user) => user.id === DEMO_USER_ID);

    expect(me?.profile).toEqual({
      role: null,
      interests: [],
      aiComfort: null,
      notificationPrefs: {
        events: true,
        replies: true,
        missions: true,
        digest: false,
      },
      onboardedAt: null,
    });
  });
});

describe('store', () => {
  test('setState swaps state atomically to a new reference', () => {
    const before = getState();
    const after = setState((current) => ({
      ...current,
      subforums: [...current.subforums, 'Test Forum'],
    }));

    expect(after).not.toBe(before);
    expect(getState()).toBe(after);
    expect(before.subforums).toHaveLength(7);
    expect(getState().subforums).toHaveLength(8);
  });

  test('resetStore restores the seed state', () => {
    setState((current) => ({ ...current, posts: [] }));
    expect(getState().posts).toHaveLength(0);

    resetStore();
    expect(getState()).toEqual(createSeedState());
  });
});

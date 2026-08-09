import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getLeaderboardRoute } from '../../app/api/leaderboard+api';
import { getLeaderboard, getLeaderboardPage } from '../../src/backend/leaderboard';
import { memoryContext } from '../../src/backend/http';
import {
  DEMO_USER_ID,
  resetStore,
  setState,
} from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('getLeaderboard', () => {
  test('ranks seed users by missionsCompleted desc then xp desc', async () => {
    const { leaders } = await getLeaderboard(ctx());

    expect(leaders.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(leaders.map((entry) => entry.user.name)).toEqual([
      'Mia Lake',
      'Andre King',
      'Jordan Diaz',
      'Priya Rao',
      'Sam Ortiz',
      'You',
    ]);
    expect(leaders.map((entry) => entry.missionsCompleted)).toEqual([
      41, 38, 35, 29, 24, 21,
    ]);
    expect(leaders.map((entry) => entry.xp)).toEqual([
      3820, 3540, 3110, 2640, 2190, 1980,
    ]);
  });

  test('breaks missionsCompleted ties by xp desc', async () => {
    setState((state) => ({
      ...state,
      users: state.users.map((user) =>
        user.id === 'user-andre' ? { ...user, missionsCompleted: 41 } : user,
      ),
    }));

    const { leaders } = await getLeaderboard(ctx());

    expect(leaders.slice(0, 2).map((entry) => entry.user.id)).toEqual([
      'user-mia',
      'user-andre',
    ]);
  });

  test('excludes users with zero completed missions', async () => {
    const { leaders } = await getLeaderboard(ctx());
    const ids = leaders.map((entry) => entry.user.id);

    expect(leaders).toHaveLength(6);
    expect(ids).not.toContain('user-hoa');
    expect(ids).not.toContain('user-riley');
  });

  test('marks only the requesting user with isMe', async () => {
    const { leaders } = await getLeaderboard(ctx());

    expect(
      leaders.filter((entry) => entry.isMe).map((entry) => entry.user.id),
    ).toEqual([DEMO_USER_ID]);
  });

  test('marks a different requesting user with isMe on their row', async () => {
    const { leaders } = await getLeaderboard(ctx('user-mia'));

    expect(
      leaders.filter((entry) => entry.isMe).map((entry) => entry.user.id),
    ).toEqual(['user-mia']);
  });

  test('computes design rankDelta values from stored previousRank', async () => {
    const { leaders } = await getLeaderboard(ctx());

    expect(leaders.map((entry) => entry.rankDelta)).toEqual([
      0, 1, -1, 2, 0, 1,
    ]);
  });

  test('rankDelta is 0 for a newly ranked user without a previousRank', async () => {
    setState((state) => ({
      ...state,
      users: state.users.map((user) =>
        user.id === 'user-riley' ? { ...user, missionsCompleted: 1 } : user,
      ),
    }));

    const { leaders } = await getLeaderboard(ctx());
    const riley = leaders.find((entry) => entry.user.id === 'user-riley');

    expect(riley?.rank).toBe(7);
    expect(riley?.rankDelta).toBe(0);
  });
});

describe('getLeaderboardPage', () => {
  test('paginates by rank and preserves that order across pages', async () => {
    const first = await getLeaderboardPage(ctx(), 'all', { limit: 2 });
    expect(first.leaders.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(first.leaders.map((entry) => entry.user.name)).toEqual([
      'Mia Lake',
      'Andre King',
    ]);
    expect(first.nextCursor).not.toBeNull();

    const second = await getLeaderboardPage(ctx(), 'all', {
      cursor: first.nextCursor,
      limit: 2,
    });
    expect(second.leaders.map((entry) => entry.rank)).toEqual([3, 4]);
    expect(second.nextCursor).not.toBeNull();

    const third = await getLeaderboardPage(ctx(), 'all', {
      cursor: second.nextCursor,
      limit: 2,
    });
    expect(third.leaders.map((entry) => entry.rank)).toEqual([5, 6]);
    expect(third.nextCursor).toBeNull();
  });

  test('a single-leader range (week) is fully exhausted on the first page', async () => {
    // Seed: mission-3 was completed 48h ago by DEMO_USER_ID -- the only
    // completion anywhere in the seed data, so week has exactly one leader.
    const page = await getLeaderboardPage(ctx(), 'week', { limit: 20 });
    expect(page.leaders).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });
});

describe('GET /api/leaderboard', () => {
  test('returns the leaders envelope with isMe on the demo-user row', async () => {
    const response = await getLeaderboardRoute(
      new Request('http://localhost/api/leaderboard'),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.leaders).toHaveLength(6);
    expect(body.leaders[0]).toEqual({
      rank: 1,
      user: { avatarUrl: null, id: 'user-mia', name: 'Mia Lake' },
      isMe: false,
      missionsCompleted: 41,
      xp: 3820,
      rankDelta: 0,
    });
    expect(body.leaders[5]).toEqual({
      rank: 6,
      user: { avatarUrl: null, id: DEMO_USER_ID, name: 'You' },
      isMe: true,
      missionsCompleted: 21,
      xp: 1980,
      rankDelta: 1,
    });
  });

  test('honors ?limit and ?cursor for pagination', async () => {
    const firstResponse = await getLeaderboardRoute(
      new Request('http://localhost/api/leaderboard?limit=2'),
    );
    const first = (await firstResponse.json()) as {
      leaders: readonly { rank: number }[];
      nextCursor: string | null;
    };
    expect(first.leaders.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(first.nextCursor).not.toBeNull();

    const secondResponse = await getLeaderboardRoute(
      new Request(
        `http://localhost/api/leaderboard?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
      ),
    );
    const second = (await secondResponse.json()) as {
      leaders: readonly { rank: number }[];
      nextCursor: string | null;
    };
    expect(second.leaders.map((entry) => entry.rank)).toEqual([3, 4]);
  });

  test('falls back to all-time for an unrecognized range value', async () => {
    const response = await getLeaderboardRoute(
      new Request('http://localhost/api/leaderboard?range=bogus'),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.leaders).toHaveLength(6);
  });
});

describe('getLeaderboard (windowed ranges)', () => {
  const daysAgoIso = (days: number) =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  test('week range only counts completions within the last 7 days', async () => {
    // Seed: mission-3 was completed 48h ago by DEMO_USER_ID — the only
    // completion anywhere in the seed data, so it's the only weekly leader.
    const { leaders } = await getLeaderboard(ctx(), 'week');

    expect(leaders).toHaveLength(1);
    expect(leaders[0]).toMatchObject({
      missionsCompleted: 1,
      rank: 1,
      user: { id: DEMO_USER_ID },
      xp: 90,
    });
  });

  test('a completion outside the window is excluded from that range but not a longer one', async () => {
    setState((state) => ({
      ...state,
      missions: state.missions.map((mission) =>
        mission.id === 'mission-1'
          ? {
              ...mission,
              progressByUser: {
                ...mission.progressByUser,
                'user-mia': {
                  completedAt: daysAgoIso(10),
                  status: 'done' as const,
                  stopsDone: 1,
                },
              },
            }
          : mission,
      ),
    }));

    const week = await getLeaderboard(ctx(), 'week');
    const month = await getLeaderboard(ctx(), 'month');

    expect(week.leaders.some((entry) => entry.user.id === 'user-mia')).toBe(
      false,
    );
    expect(month.leaders.some((entry) => entry.user.id === 'user-mia')).toBe(
      true,
    );
  });

  test('lets a new user with no lifetime history outrank veterans in the weekly view', async () => {
    // user-mia has the highest lifetime totals (41 missions, 3820 xp) but no
    // recorded completions at all — demo-user's single recent check-in wins.
    const { leaders } = await getLeaderboard(ctx(), 'week');

    expect(leaders.map((entry) => entry.user.id)).toEqual([DEMO_USER_ID]);
  });

  test('computes rankDelta against the immediately preceding window of equal length', async () => {
    setState((state) => ({
      ...state,
      missions: state.missions.map((mission) => {
        if (mission.id === 'mission-1') {
          // Only demo-user completed something in the previous week (8-14
          // days ago), so they ranked 1st there.
          return {
            ...mission,
            progressByUser: {
              ...mission.progressByUser,
              [DEMO_USER_ID]: {
                completedAt: daysAgoIso(10),
                status: 'done' as const,
                stopsDone: 1,
              },
            },
          };
        }
        if (mission.id === 'mission-2') {
          // user-mia overtakes demo-user in the current week (higher xp),
          // so demo-user drops from 1st to 2nd.
          return {
            ...mission,
            progressByUser: {
              ...mission.progressByUser,
              'user-mia': {
                completedAt: daysAgoIso(1),
                status: 'done' as const,
                stopsDone: 3,
              },
            },
          };
        }
        return mission;
      }),
    }));

    const { leaders } = await getLeaderboard(ctx(), 'week');

    const mia = leaders.find((entry) => entry.user.id === 'user-mia');
    const demo = leaders.find((entry) => entry.user.id === DEMO_USER_ID);
    expect(mia).toMatchObject({ rank: 1, rankDelta: 0 });
    expect(demo).toMatchObject({ rank: 2, rankDelta: -1 });
  });
});

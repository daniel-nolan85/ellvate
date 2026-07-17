import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getLeaderboardRoute } from '../../app/api/leaderboard+api';
import { getLeaderboard } from '../../src/backend/leaderboard';
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
});

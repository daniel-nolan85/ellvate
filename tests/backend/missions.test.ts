import { afterEach, describe, expect, test } from 'bun:test';

import {
  GET as getMissions,
  POST as postMission,
} from '../../app/api/missions+api';
import { POST as postCheckIn } from '../../app/api/missions/[id]/check-in+api';
import { memoryContext } from '../../src/backend/http';
import { checkIn, createMission, getMissionsView } from '../../src/backend/missions';
import { computeProgress } from '../../src/backend/progress';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('getMissionsView', () => {
  test('mission statuses and stops match the seed for demo-user', async () => {
    const { missions } = await getMissionsView(ctx());

    expect(missions.map((mission) => mission.id)).toEqual([
      'mission-1',
      'mission-2',
      'mission-3',
      'mission-4',
    ]);
    expect(missions.map((mission) => mission.status)).toEqual([
      'active',
      'active',
      'done',
      'locked',
    ]);
    expect(missions.map((mission) => mission.stopsDone)).toEqual([0, 2, 3, 0]);
    expect(missions.map((mission) => mission.stopsTotal)).toEqual([1, 3, 3, 1]);
    expect(missions.map((mission) => mission.xp)).toEqual([50, 120, 90, 40]);
    expect(missions.map((mission) => mission.icon)).toEqual([
      'Sun',
      'ArrowUp',
      'Star',
      'Moon',
    ]);
  });

  test('progress matches computeProgress for the seed demo-user', async () => {
    const { progress } = await getMissionsView(ctx());
    const breakdown = computeProgress(1980);

    expect(progress).toEqual({
      level: breakdown.level,
      xp: 1980,
      xpIntoLevel: breakdown.xpIntoLevel,
      xpForNextLevel: breakdown.xpForNextLevel,
      xpToNextLevel: breakdown.xpToNextLevel,
      streakDays: 12,
      missionsCompleted: 21,
      title: 'LAKE EXPLORER',
    });
    expect(progress.level).toBe(7);
    expect(progress.xpToNextLevel).toBe(120);
  });

  test('users without a stored entry default to active with 0 stops', async () => {
    const { missions } = await getMissionsView(ctx('user-mia'));

    expect(missions.every((mission) => mission.status === 'active')).toBe(
      true,
    );
    expect(missions.every((mission) => mission.stopsDone === 0)).toBe(true);
  });

  test('unknown users get zeroed progress with the default title', async () => {
    const { progress } = await getMissionsView(ctx('user-nobody'));

    expect(progress).toEqual({
      level: 1,
      xp: 0,
      xpIntoLevel: 0,
      xpForNextLevel: 300,
      xpToNextLevel: 300,
      streakDays: 0,
      missionsCompleted: 0,
      title: 'LAKE EXPLORER',
    });
  });
});

describe('checkIn', () => {
  test('advances one stop without awarding XP when the mission is not complete', async () => {
    const result = await checkIn(ctx('user-mia'), 'mission-2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.body.mission.status).toBe('active');
    expect(result.body.mission.stopsDone).toBe(1);
    expect(result.body.mission.stopsTotal).toBe(3);
    expect(result.body.awardedXp).toBe(0);
    expect(result.body.progress.xp).toBe(3820);
    expect(result.body.progress.missionsCompleted).toBe(41);
    expect(result.body.progress.streakDays).toBe(0);
  });

  test('completing the final stop marks the mission done and awards its XP', async () => {
    const result = await checkIn(ctx(), 'mission-2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.body.mission.status).toBe('done');
    expect(result.body.mission.stopsDone).toBe(3);
    expect(result.body.awardedXp).toBe(120);

    const breakdown = computeProgress(1980 + 120);
    expect(result.body.progress).toEqual({
      level: breakdown.level,
      xp: 2100,
      xpIntoLevel: breakdown.xpIntoLevel,
      xpForNextLevel: breakdown.xpForNextLevel,
      xpToNextLevel: breakdown.xpToNextLevel,
      streakDays: 13,
      missionsCompleted: 22,
      title: 'LAKE EXPLORER',
    });
    expect(result.body.progress.level).toBe(8);
  });

  test('single-stop mission completes and awards full XP on one check-in', async () => {
    const result = await checkIn(ctx(), 'mission-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.body.mission.status).toBe('done');
    expect(result.body.mission.stopsDone).toBe(1);
    expect(result.body.awardedXp).toBe(50);
    expect(result.body.progress.xp).toBe(2030);
    expect(result.body.progress.missionsCompleted).toBe(22);
    expect(result.body.progress.streakDays).toBe(13);
  });

  test('completion persists in the store and in the missions view', async () => {
    await checkIn(ctx(), 'mission-1');
    const { missions, progress } = await getMissionsView(ctx());

    expect(missions.find((m) => m.id === 'mission-1')?.status).toBe('done');
    expect(progress.xp).toBe(2030);
    expect(progress.missionsCompleted).toBe(22);
  });

  test('rejects a locked mission with 409 mission_locked', async () => {
    const result = await checkIn(ctx(), 'mission-4');

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'mission_locked',
    });
  });

  test('rejects an already completed mission with 409 mission_complete', async () => {
    const result = await checkIn(ctx(), 'mission-3');

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: 'mission_complete',
    });
  });

  test('rejects a second check-in after completing a mission', async () => {
    expect((await checkIn(ctx(), 'mission-1')).ok).toBe(true);

    expect(await checkIn(ctx(), 'mission-1')).toMatchObject({
      ok: false,
      status: 409,
      code: 'mission_complete',
    });
  });

  test('rejects an unknown mission with 404 mission_not_found', async () => {
    expect(await checkIn(ctx(), 'mission-999')).toMatchObject({
      ok: false,
      status: 404,
      code: 'mission_not_found',
    });
  });

  test('does not mutate the previous store state', async () => {
    const before = getState();
    await checkIn(ctx(), 'mission-2');

    const beforeMission = before.missions.find((m) => m.id === 'mission-2');
    const beforeUser = before.users.find((u) => u.id === DEMO_USER_ID);
    expect(beforeMission?.progressByUser[DEMO_USER_ID]?.stopsDone).toBe(2);
    expect(beforeUser?.xp).toBe(1980);
    expect(getState()).not.toBe(before);
  });

  test('does not touch other users or missions on check-in', async () => {
    await checkIn(ctx(), 'mission-2');
    const state = getState();

    expect(state.users.find((u) => u.id === 'user-mia')?.xp).toBe(3820);
    expect(
      state.missions.find((m) => m.id === 'mission-1')?.progressByUser[
        DEMO_USER_ID
      ],
    ).toEqual({ status: 'active', stopsDone: 0 });
  });
});

describe('createMission', () => {
  const validInput = {
    description: 'Rent a kayak and get on the water.',
    icon: 'Sun',
    scheduledFor: '2026-07-18',
    stopsTotal: 1,
    title: 'Paddle the Lake',
    xp: 75,
  };

  test('creates an active mission and lists it', async () => {
    const result = await createMission(ctx(), validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.mission).toMatchObject({
      title: 'Paddle the Lake',
      scheduledFor: '2026-07-18',
      xp: 75,
      stopsTotal: 1,
      status: 'active',
      stopsDone: 0,
      icon: 'Sun',
    });

    const listed = (await getMissionsView(ctx())).missions.find(
      (mission) => mission.id === result.mission.id,
    );
    expect(listed).toBeDefined();
  });

  test('rejects out-of-range xp', async () => {
    const result = await createMission(ctx(), { ...validInput, xp: 9999 });

    expect(result).toMatchObject({ ok: false, code: 'invalid_mission' });
  });

  test('rejects an unknown icon', async () => {
    const result = await createMission(ctx(), { ...validInput, icon: 'Rocket' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_mission' });
  });

  test('rejects a normalized calendar date', async () => {
    const result = await createMission(ctx(), {
      ...validInput,
      scheduledFor: '2026-02-31',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_mission' });
  });
});

describe('POST /api/missions', () => {
  const postMissionRequest = (body: unknown) =>
    postMission(
      new Request('http://localhost/api/missions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  test('creates a mission and returns 201', async () => {
    const response = await postMissionRequest({
      description: 'Spend an afternoon at the Westin beach.',
      icon: 'Star',
      scheduledFor: '2026-07-19',
      stopsTotal: 1,
      title: 'Beach Day',
      xp: 50,
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      mission: { title: string; status: string; scheduledFor: string | null };
    };
    expect(body.mission).toMatchObject({
      title: 'Beach Day',
      status: 'active',
      scheduledFor: '2026-07-19',
    });
  });

  test('400s with the ApiError envelope on invalid input', async () => {
    const response = await postMissionRequest({ title: '' });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_mission');
  });
});

describe('GET /api/missions', () => {
  test('returns missions and progress for demo-user', async () => {
    const response = await getMissions(
      new Request('http://localhost/api/missions'),
    );
    const body = (await response.json()) as {
      missions: readonly { id: string; status: string }[];
      progress: { xp: number; level: number; title: string };
    };

    expect(response.status).toBe(200);
    expect(body.missions).toHaveLength(4);
    expect(body.missions.map((mission) => mission.status)).toEqual([
      'active',
      'active',
      'done',
      'locked',
    ]);
    expect(body.progress).toMatchObject({
      xp: 1980,
      level: 7,
      title: 'LAKE EXPLORER',
    });
  });
});

describe('POST /api/missions/:id/check-in', () => {
  const checkInRequest = (id: string): Promise<Response> =>
    postCheckIn(
      new Request(`http://localhost/api/missions/${id}/check-in`, {
        method: 'POST',
      }),
      { id },
    );

  test('returns mission, awardedXp, and progress on completion', async () => {
    const response = await checkInRequest('mission-1');
    const body = (await response.json()) as {
      mission: { id: string; status: string; stopsDone: number };
      awardedXp: number;
      progress: { xp: number; streakDays: number; missionsCompleted: number };
    };

    expect(response.status).toBe(200);
    expect(body.mission).toMatchObject({
      id: 'mission-1',
      status: 'done',
      stopsDone: 1,
    });
    expect(body.awardedXp).toBe(50);
    expect(body.progress).toMatchObject({
      xp: 2030,
      streakDays: 13,
      missionsCompleted: 22,
    });
  });

  test('returns the 409 mission_locked error envelope', async () => {
    const response = await checkInRequest('mission-4');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'mission_locked',
      message: 'Mission is locked.',
    });
  });

  test('returns the 409 mission_complete error envelope', async () => {
    const response = await checkInRequest('mission-3');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'mission_complete',
      message: 'Mission is already complete.',
    });
  });

  test('returns 404 for an unknown mission', async () => {
    const response = await checkInRequest('mission-999');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 'mission_not_found',
      message: 'Mission not found.',
    });
  });
});

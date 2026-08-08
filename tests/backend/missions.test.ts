import { afterEach, describe, expect, test } from 'bun:test';

import {
  GET as getMissions,
  POST as postMission,
} from '../../app/api/missions+api';
import {
  DELETE as deleteMissionRoute,
  PATCH as patchMissionRoute,
} from '../../app/api/missions/[id]/index+api';
import { POST as postAccept } from '../../app/api/missions/[id]/accept+api';
import { POST as postCheckIn } from '../../app/api/missions/[id]/check-in+api';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import {
  acceptMission,
  checkIn,
  createMission,
  deleteMission,
  getMissionsView,
  updateMission,
} from '../../src/backend/missions';
import { computeProgress } from '../../src/backend/progress';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
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
      'active',
    ]);
    expect(missions.map((mission) => mission.stopsDone)).toEqual([0, 2, 3, 0]);
    expect(missions.map((mission) => mission.stopsTotal)).toEqual([1, 3, 3, 1]);
    expect(missions.map((mission) => mission.xp)).toEqual([50, 120, 90, 40]);
    expect(missions.map((mission) => mission.theme)).toEqual([
      'water',
      'trail',
      'village',
      'night',
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

describe('acceptMission', () => {
  test('mission-1 starts unaccepted for the demo user', async () => {
    const { missions } = await getMissionsView(ctx());
    const mission1 = missions.find((mission) => mission.id === 'mission-1');

    expect(mission1?.accepted).toBe(false);
    expect(mission1?.stopsDone).toBe(0);
  });

  test('accepting a fresh mission creates a 0-stop progress entry', async () => {
    const result = await acceptMission(ctx(), 'mission-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mission.accepted).toBe(true);
    expect(result.mission.stopsDone).toBe(0);
    expect(result.mission.status).toBe('active');

    const { missions } = await getMissionsView(ctx());
    expect(missions.find((mission) => mission.id === 'mission-1')?.accepted).toBe(
      true,
    );
  });

  test('is idempotent — accepting an in-progress mission does not reset its stops', async () => {
    // mission-2 is already 2/3 for the demo user via seed data.
    const result = await acceptMission(ctx(), 'mission-2');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mission.accepted).toBe(true);
    expect(result.mission.stopsDone).toBe(2);
  });

  test('rejects an unknown mission', async () => {
    const result = await acceptMission(ctx(), 'mission-999');

    expect(result).toMatchObject({ ok: false, status: 404, code: 'mission_not_found' });
  });

  test('POST /api/missions/:id/accept returns { mission }', async () => {
    const response = await postAccept(
      new Request('http://localhost/api/missions/mission-4/accept', {
        method: 'POST',
      }),
      { id: 'mission-4' },
    );

    expect(response.status).toBe(200);
    const { mission } = (await response.json()) as { mission: { accepted: boolean } };
    expect(mission.accepted).toBe(true);
  });
});

const CHECK_IN_PHOTO = {
  checkInPhoto: { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'proof.jpg' },
};

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

  test('rejects the completing check-in without a photo', async () => {
    const result = await checkIn(ctx(), 'mission-2');

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: 'photo_required',
    });
  });

  test('completing the final stop marks the mission done and awards its XP', async () => {
    const result = await checkIn(ctx(), 'mission-2', CHECK_IN_PHOTO);

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
    const result = await checkIn(ctx(), 'mission-1', CHECK_IN_PHOTO);

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
    await checkIn(ctx(), 'mission-1', CHECK_IN_PHOTO);
    const { missions, progress } = await getMissionsView(ctx());

    expect(missions.find((m) => m.id === 'mission-1')?.status).toBe('done');
    expect(progress.xp).toBe(2030);
    expect(progress.missionsCompleted).toBe(22);
  });

  test('checks in on a not-yet-started mission and awards its XP', async () => {
    const result = await checkIn(ctx(), 'mission-4', CHECK_IN_PHOTO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.body.mission.status).toBe('done');
    expect(result.body.mission.stopsDone).toBe(1);
    expect(result.body.awardedXp).toBe(40);
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
    expect((await checkIn(ctx(), 'mission-1', CHECK_IN_PHOTO)).ok).toBe(true);

    expect(await checkIn(ctx(), 'mission-1', CHECK_IN_PHOTO)).toMatchObject({
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
    await checkIn(ctx(), 'mission-2', CHECK_IN_PHOTO);

    const beforeMission = before.missions.find((m) => m.id === 'mission-2');
    const beforeUser = before.users.find((u) => u.id === DEMO_USER_ID);
    expect(beforeMission?.progressByUser[DEMO_USER_ID]?.stopsDone).toBe(2);
    expect(beforeUser?.xp).toBe(1980);
    expect(getState()).not.toBe(before);
  });

  test('does not touch other users or missions on check-in', async () => {
    await checkIn(ctx(), 'mission-2', CHECK_IN_PHOTO);
    const state = getState();

    expect(state.users.find((u) => u.id === 'user-mia')?.xp).toBe(3820);
    // mission-1 has no seeded progress entry for the demo user (not yet
    // accepted) — checking in on a different mission must not create one.
    expect(
      state.missions.find((m) => m.id === 'mission-1')?.progressByUser[
        DEMO_USER_ID
      ],
    ).toBeUndefined();
  });
});

describe('createMission', () => {
  const validInput = {
    description: 'Rent a kayak and get on the water.',
    theme: 'day',
    scheduledFor: '2026-07-18',
    stops: ['Stop 1'],
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
      theme: 'day',
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

  test('rejects an unknown theme', async () => {
    const result = await createMission(ctx(), { ...validInput, theme: 'space' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_mission' });
  });

  test('rejects a normalized calendar date', async () => {
    const result = await createMission(ctx(), {
      ...validInput,
      scheduledFor: '2026-02-31',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_mission' });
  });

  test('stores uploaded images as mission media', async () => {
    const result = await createMission(ctx(), {
      ...validInput,
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'kayak.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission.media).toEqual([
        { filename: 'kayak.jpg', url: 'data:image/jpeg;base64,b25l' },
      ]);
    }
  });

  test('a mission with no images has undefined media', async () => {
    const result = await createMission(ctx(), validInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission.media).toBeUndefined();
    }
  });
});

describe('updateMission', () => {
  const editInput = {
    description: 'Updated description.',
    theme: 'social',
    scheduledFor: '2026-07-25',
    stops: ['Stop 1', 'Stop 2'],
    title: 'Updated Mission',
    xp: 100,
  };

  test('the author can edit their own mission', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updateMission(ctx(), created.mission.id, editInput);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.mission).toMatchObject({
      title: 'Updated Mission',
      description: 'Updated description.',
      xp: 100,
      stopsTotal: 2,
      theme: 'social',
    });
  });

  test('stamps editedAt on update, unset until then', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    expect(created.mission.editedAt).toBeNull();

    const result = await updateMission(ctx(), created.mission.id, editInput);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.mission.editedAt).not.toBeNull();
  });

  test('rejects edits from a user who does not own the mission', async () => {
    const result = await updateMission(ctx(), 'mission-1', editInput);

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('returns not_found for an unknown mission', async () => {
    const result = await updateMission(ctx('user-hoa'), 'mission-999', editInput);

    expect(result).toMatchObject({ ok: false, code: 'mission_not_found' });
  });

  test('rejects invalid input', async () => {
    const result = await updateMission(ctx('user-hoa'), 'mission-1', {
      ...editInput,
      title: '',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_mission' });
  });

  test('keeps existing media while adding new uploads', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'one.jpg' },
      ],
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updateMission(ctx(), created.mission.id, {
      ...editInput,
      existingMedia: [
        { filename: 'one.jpg', url: 'data:image/jpeg;base64,b25l' },
      ],
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,dHdv', filename: 'two.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission.media).toEqual([
        { filename: 'one.jpg', url: 'data:image/jpeg;base64,b25l' },
        { filename: 'two.jpg', url: 'data:image/jpeg;base64,dHdv' },
      ]);
    }
  });

  test('removes all media when the client omits existingMedia and newMedia', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'one.jpg' },
      ],
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updateMission(ctx(), created.mission.id, editInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mission.media).toBeUndefined();
    }
  });
});

describe('deleteMission', () => {
  test('the author can delete their own mission', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    expect(await deleteMission(ctx(), created.mission.id)).toBe(true);
    expect(
      (await getMissionsView(ctx())).missions.some(
        (mission) => mission.id === created.mission.id,
      ),
    ).toBe(false);
  });

  test('returns false for a user who does not own the mission', async () => {
    expect(await deleteMission(ctx(), 'mission-1')).toBe(false);
    expect(
      (await getMissionsView(ctx())).missions.some(
        (mission) => mission.id === 'mission-1',
      ),
    ).toBe(true);
  });

  test('returns false for an unknown mission', async () => {
    expect(await deleteMission(ctx('user-hoa'), 'mission-999')).toBe(false);
  });
});

describe('PATCH /api/missions/:id', () => {
  const patchMissionRequest = (id: string, body: unknown) =>
    patchMissionRoute(
      new Request(`http://localhost/api/missions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { id },
    );

  test('updates a mission owned by the demo user and returns 200', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const response = await patchMissionRequest(created.mission.id, {
      description: 'Updated description.',
      theme: 'social',
      scheduledFor: '2026-07-25',
      stops: ['Stop 1', 'Stop 2'],
      title: 'Updated Mission',
      xp: 100,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mission: { title: string; xp: number };
    };
    expect(body.mission).toMatchObject({ title: 'Updated Mission', xp: 100 });
  });

  test('returns 403 when editing someone else’s mission', async () => {
    const response = await patchMissionRequest('mission-1', {
      description: 'Updated description.',
      theme: 'social',
      scheduledFor: '2026-07-25',
      stops: ['Stop 1', 'Stop 2'],
      title: 'Hijack',
      xp: 100,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 'forbidden',
      message: 'You can only edit your own missions.',
    });
  });

  test('returns 404 for an unknown mission', async () => {
    const response = await patchMissionRequest('mission-999', {
      description: 'Updated description.',
      theme: 'social',
      scheduledFor: '2026-07-25',
      stops: ['Stop 1', 'Stop 2'],
      title: 'Updated Mission',
      xp: 100,
    });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/missions/:id', () => {
  test('deletes a mission owned by the demo user and returns 200', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const response = await deleteMissionRoute(
      new Request(`http://localhost/api/missions/${created.mission.id}`, {
        method: 'DELETE',
      }),
      { id: created.mission.id },
    );

    expect(response.status).toBe(200);
  });

  test('returns 404 when deleting someone else’s mission', async () => {
    const response = await deleteMissionRoute(
      new Request('http://localhost/api/missions/mission-1', {
        method: 'DELETE',
      }),
      { id: 'mission-1' },
    );

    expect(response.status).toBe(404);
  });

  test('404s for an unknown mission', async () => {
    const response = await deleteMissionRoute(
      new Request('http://localhost/api/missions/mission-999', {
        method: 'DELETE',
      }),
      { id: 'mission-999' },
    );

    expect(response.status).toBe(404);
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
      theme: 'social',
      scheduledFor: '2026-07-19',
      stops: ['Stop 1'],
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
      'active',
    ]);
    expect(body.progress).toMatchObject({
      xp: 1980,
      level: 7,
      title: 'LAKE EXPLORER',
    });
  });
});

describe('POST /api/missions/:id/check-in', () => {
  const checkInRequest = (id: string, body: unknown = null): Promise<Response> =>
    postCheckIn(
      new Request(`http://localhost/api/missions/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { id },
    );

  test('returns mission, awardedXp, and progress on completion', async () => {
    const response = await checkInRequest('mission-1', CHECK_IN_PHOTO);
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

  test('checks in on mission-4 and returns 200', async () => {
    const response = await checkInRequest('mission-4', CHECK_IN_PHOTO);
    const body = (await response.json()) as {
      mission: { id: string; status: string; stopsDone: number };
      awardedXp: number;
    };

    expect(response.status).toBe(200);
    expect(body.mission).toMatchObject({
      id: 'mission-4',
      status: 'done',
      stopsDone: 1,
    });
    expect(body.awardedXp).toBe(40);
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

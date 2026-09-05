import { afterEach, describe, expect, test } from 'bun:test';

import { POST as reportRoute } from '../../app/api/mission-check-ins/[id]/report+api';
import { GET as getCheckIns } from '../../app/api/missions/[id]/check-ins+api';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import {
  checkIn,
  CHECK_INS_LIST_LIMIT,
  createMission,
  deleteMission,
  listMissionCheckIns,
  reportCheckIn,
} from '../../src/backend/missions';
import type { ValidReportSubmission } from '@/src/backend/reports';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);
const TEST_REPORT_SUBMISSION: ValidReportSubmission = {
  details: null,
  evidenceImageDataUrl: null,
  reason: 'other',
};

const PHOTO = {
  checkInPhoto: { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'proof.jpg' },
};

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

describe('listMissionCheckIns', () => {
  test('returns an empty list for a mission with no check-ins', async () => {
    expect(await listMissionCheckIns(ctx(), 'mission-1')).toEqual([]);
  });

  test('returns check-ins oldest-first with the checking-in user attached', async () => {
    // Fresh users (no seeded progress) start mission-2 at 0/3 stops, so this
    // is a non-completing first check-in for both — stopIndex 0, no photo.
    await checkIn(ctx('user-mia'), 'mission-2');
    await checkIn(ctx('user-andre'), 'mission-2');

    const checkIns = await listMissionCheckIns(ctx(), 'mission-2');
    expect(checkIns).toHaveLength(2);
    expect(checkIns[0]).toMatchObject({
      missionId: 'mission-2',
      stopIndex: 0,
      photoUrl: null,
      user: { id: 'user-mia' },
    });
    expect(checkIns[1]).toMatchObject({
      missionId: 'mission-2',
      stopIndex: 0,
      photoUrl: null,
      user: { id: 'user-andre' },
    });
  });

  test('caps to the most recent N, still oldest-first within that window', async () => {
    const total = CHECK_INS_LIST_LIMIT + 5;
    for (let i = 0; i < total; i += 1) {
      await checkIn(ctx(`user-${i}`), 'mission-2');
    }

    const checkIns = await listMissionCheckIns(ctx(), 'mission-2');
    expect(checkIns).toHaveLength(CHECK_INS_LIST_LIMIT);
    // The oldest 5 (user-0..user-4) should have been dropped, keeping the
    // most recent CHECK_INS_LIST_LIMIT — returned oldest-first within them.
    expect(checkIns[0]).toMatchObject({ user: { id: 'user-5' } });
    expect(checkIns[checkIns.length - 1]).toMatchObject({
      user: { id: `user-${total - 1}` },
    });
  });
});

describe('checkIn photo requirement', () => {
  test('does not record a check-in when the completing stop is rejected for missing a photo', async () => {
    const result = await checkIn(ctx(), 'mission-2');

    expect(result).toMatchObject({ ok: false, status: 400, code: 'photo_required' });
    expect(await listMissionCheckIns(ctx(), 'mission-2')).toEqual([]);
  });

  test('records a check-in with the photo url when the completing stop includes one', async () => {
    const result = await checkIn(ctx(), 'mission-2', PHOTO);

    expect(result.ok).toBe(true);
    const checkIns = await listMissionCheckIns(ctx(), 'mission-2');
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0]).toMatchObject({
      missionId: 'mission-2',
      stopIndex: 2,
      photoUrl: 'data:image/jpeg;base64,b25l',
      user: { id: DEMO_USER_ID },
    });
  });

  test('does not require a photo on a non-completing stop', async () => {
    const result = await checkIn(ctx('user-mia'), 'mission-2');

    expect(result.ok).toBe(true);
    const checkIns = await listMissionCheckIns(ctx(), 'mission-2');
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0]).toMatchObject({ stopIndex: 0, photoUrl: null });
  });
});

describe('reportCheckIn', () => {
  test('reports an existing check-in', async () => {
    const created = await checkIn(ctx('user-mia'), 'mission-2');
    if (!created.ok) {
      throw new Error('setup failed');
    }
    const [entry] = await listMissionCheckIns(ctx(), 'mission-2');
    if (!entry) {
      throw new Error('setup failed');
    }

    const result = await reportCheckIn(ctx('user-andre'), entry.id, TEST_REPORT_SUBMISSION);

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().missionCheckInReports.some(
        (report) => report.checkInId === entry.id && report.reporterId === 'user-andre',
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same check-in twice records one report', async () => {
    const created = await checkIn(ctx('user-mia'), 'mission-2');
    if (!created.ok) {
      throw new Error('setup failed');
    }
    const [entry] = await listMissionCheckIns(ctx(), 'mission-2');
    if (!entry) {
      throw new Error('setup failed');
    }

    await reportCheckIn(ctx('user-andre'), entry.id, TEST_REPORT_SUBMISSION);
    await reportCheckIn(ctx('user-andre'), entry.id, TEST_REPORT_SUBMISSION);

    expect(
      getState().missionCheckInReports.filter(
        (report) => report.checkInId === entry.id && report.reporterId === 'user-andre',
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown check-in', async () => {
    const result = await reportCheckIn(ctx(), 'check-in-nope', TEST_REPORT_SUBMISSION);

    expect(result).toMatchObject({ ok: false, code: 'check_in_not_found' });
  });
});

describe('deleteMission cascade', () => {
  test('removes check-ins and check-in reports belonging to the deleted mission', async () => {
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
    const checkedIn = await checkIn(ctx('user-mia'), created.mission.id, PHOTO);
    if (!checkedIn.ok) {
      throw new Error('setup failed');
    }
    const [entry] = await listMissionCheckIns(ctx(), created.mission.id);
    if (!entry) {
      throw new Error('setup failed');
    }
    await reportCheckIn(ctx('user-andre'), entry.id, TEST_REPORT_SUBMISSION);

    expect(await deleteMission(ctx(), created.mission.id)).toBe(true);
    expect(await listMissionCheckIns(ctx(), created.mission.id)).toEqual([]);
    expect(
      getState().missionCheckInReports.some((report) => report.checkInId === entry.id),
    ).toBe(false);
  });
});

describe('mission check-in routes', () => {
  test('GET /api/missions/:id/check-ins returns { checkIns }', async () => {
    await checkIn(ctx('user-mia'), 'mission-2');

    const response = await getCheckIns(
      new Request('http://localhost/api/missions/mission-2/check-ins'),
      { id: 'mission-2' },
    );
    expect(response.status).toBe(200);
    const { checkIns } = (await response.json()) as {
      checkIns: readonly { missionId: string }[];
    };
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0]?.missionId).toBe('mission-2');
  });

  test('POST /api/mission-check-ins/:id/report returns { reported: true }', async () => {
    await checkIn(ctx('user-mia'), 'mission-2');
    const [entry] = await listMissionCheckIns(ctx(), 'mission-2');
    if (!entry) {
      throw new Error('setup failed');
    }

    const response = await reportRoute(
      new Request(`http://localhost/api/mission-check-ins/${entry.id}/report`, {
        body: JSON.stringify({ reason: 'other' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      { id: entry.id },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reported: true });
  });

  test('POST /api/mission-check-ins/:id/report returns 404 for an unknown check-in', async () => {
    const response = await reportRoute(
      new Request('http://localhost/api/mission-check-ins/check-in-nope/report', {
        body: JSON.stringify({ reason: 'other' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      { id: 'check-in-nope' },
    );
    expect(response.status).toBe(404);
  });
});

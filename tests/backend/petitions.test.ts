import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getPetitions, POST as postPetition } from '../../app/api/petitions+api';
import { GET as getGate } from '../../app/api/petitions/gate+api';
import { GET as getPetitionRoute } from '../../app/api/petitions/[id]/index+api';
import { POST as postSign } from '../../app/api/petitions/[id]/sign+api';
import { POST as postReport } from '../../app/api/petitions/[id]/report+api';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import {
  computeRequiredSignatures,
  createPetition,
  getPetition,
  getPetitionsGate,
  listPetitionsPage,
  PETITIONS_SIGNATURE_FLOOR,
  PETITIONS_UNLOCK_MIN_USERS,
  reportPetition,
  toggleSignature,
} from '../../src/backend/petitions';
import { toggleMute } from '../../src/backend/mutes';
import { DEMO_USER_ID, getState, resetStore, setState } from '../../src/backend/store';
import type { StoredPetition, StoredUser } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

// Padding the user list past PETITIONS_UNLOCK_MIN_USERS is the only way to
// unlock petition creation in memory mode -- there's no separate "unlock
// override" for tests, deliberately, so this exercises the exact same gate
// path production traffic does.
function unlockPetitions(): void {
  setState((current) => {
    const existing = current.users.length;
    const needed = Math.max(0, PETITIONS_UNLOCK_MIN_USERS - existing);
    const extra: StoredUser[] = Array.from({ length: needed }, (_, index) => ({
      avatarUrl: null,
      id: `fixture-user-${index}`,
      missionsCompleted: 0,
      name: `Fixture User ${index}`,
      mutedUserIds: [],
      pinnedPostId: null,
      previousRank: null,
      profile: {
        activityVisible: false,
        interests: [],
        notificationPrefs: {
          digest: false,
          events: true,
          missions: true,
          petitions: true,
          replies: true,
        },
        onboardedAt: null,
        role: null,
      },
      streakDays: 0,
      title: 'LAKE EXPLORER',
      xp: 0,
    }));
    return { ...current, users: [...current.users, ...extra] };
  });
}

// Inserts a petition directly into the store, bypassing createPetition (and
// therefore the unlock gate) -- used by tests that need a ready-made
// petition to sign/report/comment on without caring how it was created.
function seedPetition(overrides: Partial<StoredPetition> = {}): StoredPetition {
  const stored: StoredPetition = {
    category: 'safety',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: DEMO_USER_ID,
    deadlineAt: '2026-12-31T00:00:00.000Z',
    deadlineDays: 30,
    description: 'A description of the issue.',
    hoaEmailSentAt: null,
    hoaResponse: null,
    hoaResponseAt: null,
    id: `fixture-petition-${Math.random().toString(36).slice(2)}`,
    requiredSignatures: 3,
    signatureCount: 0,
    status: 'open',
    succeededAt: null,
    title: 'Fixture petition',
    ...overrides,
  };
  setState((current) => ({ ...current, petitions: [...current.petitions, stored] }));
  return stored;
}

describe('computeRequiredSignatures', () => {
  test('floors at PETITIONS_SIGNATURE_FLOOR below the percentage threshold', () => {
    expect(computeRequiredSignatures(50)).toBe(PETITIONS_SIGNATURE_FLOOR);
    expect(computeRequiredSignatures(200)).toBe(PETITIONS_SIGNATURE_FLOOR);
  });

  test('switches to 20% once that exceeds the floor', () => {
    expect(computeRequiredSignatures(2000)).toBe(400);
  });
});

describe('getPetitionsGate', () => {
  test('locked below PETITIONS_UNLOCK_MIN_USERS, reporting how many more are needed', async () => {
    const gate = await getPetitionsGate(ctx());
    expect(gate.unlocked).toBe(false);
    expect(gate.usersNeeded).toBe(PETITIONS_UNLOCK_MIN_USERS - gate.totalUsers);
  });

  test('unlocked at or above PETITIONS_UNLOCK_MIN_USERS', async () => {
    unlockPetitions();
    const gate = await getPetitionsGate(ctx());
    expect(gate.unlocked).toBe(true);
    expect(gate.usersNeeded).toBe(0);
  });

  test('GET /api/petitions/gate returns the same shape', async () => {
    const response = await getGate(new Request('http://test/api/petitions/gate'));
    const body = (await response.json()) as { unlocked: boolean };
    expect(body.unlocked).toBe(false);
  });
});

describe('createPetition', () => {
  test('is rejected while the community is below the unlock threshold', async () => {
    const result = await createPetition(ctx(), {
      category: 'safety',
      deadlineDays: 30,
      description: 'Needs lighting.',
      title: 'Add lighting',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('petitions_locked');
    }
  });

  test('freezes required_signatures at the community size at creation time', async () => {
    unlockPetitions();
    const totalUsers = getState().users.length;

    const result = await createPetition(ctx(), {
      category: 'safety',
      deadlineDays: 30,
      description: 'Needs lighting.',
      title: 'Add lighting',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.petition.requiredSignatures).toBe(computeRequiredSignatures(totalUsers));
      expect(result.petition.signatureCount).toBe(0);
      expect(result.petition.status).toBe('open');
    }
  });

  test('rejects an invalid category', async () => {
    unlockPetitions();
    const result = await createPetition(ctx(), {
      category: 'not-a-real-category',
      deadlineDays: 30,
      description: 'Needs lighting.',
      title: 'Add lighting',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_petition');
    }
  });

  test('POST /api/petitions creates a petition once unlocked', async () => {
    unlockPetitions();
    const response = await postPetition(
      new Request('http://test/api/petitions', {
        body: JSON.stringify({
          category: 'maintenance',
          deadlineDays: 14,
          description: 'Fix the thing.',
          title: 'Fix the thing please',
        }),
        method: 'POST',
      }),
    );
    expect(response.status).toBe(201);
  });

  test('GET /api/petitions lists open petitions by default', async () => {
    setState((current) => ({ ...current, petitions: [] }));
    seedPetition({ status: 'open', title: 'Open one' });
    seedPetition({ status: 'succeeded', title: 'Succeeded one' });

    const response = await getPetitions(new Request('http://test/api/petitions'));
    const body = (await response.json()) as { petitions: readonly { title: string }[] };
    expect(body.petitions.map((p) => p.title)).toEqual(['Open one']);
  });
});

describe('listPetitionsPage', () => {
  test('filters by status', async () => {
    setState((current) => ({ ...current, petitions: [] }));
    seedPetition({ id: 'p-open', status: 'open' });
    seedPetition({ id: 'p-succeeded', status: 'succeeded' });
    seedPetition({ id: 'p-expired', status: 'expired' });

    expect((await listPetitionsPage(ctx(), { status: 'open' })).petitions.map((p) => p.id)).toEqual([
      'p-open',
    ]);
    expect(
      (await listPetitionsPage(ctx(), { status: 'succeeded' })).petitions.map((p) => p.id),
    ).toEqual(['p-succeeded']);
    expect(
      (await listPetitionsPage(ctx(), { status: 'expired' })).petitions.map((p) => p.id),
    ).toEqual(['p-expired']);
  });

  test('excludes petitions created by a muted author', async () => {
    setState((current) => ({ ...current, petitions: [] }));
    seedPetition({ id: 'p-mine', status: 'open' });
    seedPetition({ createdBy: 'user-mia', id: 'p-mia', status: 'open' });
    await toggleMute(ctx(), 'user-mia');

    const page = await listPetitionsPage(ctx(), { status: 'open' });
    expect(page.petitions.map((p) => p.id)).toEqual(['p-mine']);
  });
});

describe('getPetition', () => {
  test('reports signed relative to the requesting user only', async () => {
    const petition = seedPetition();
    setState((current) => ({
      ...current,
      petitionSignatures: [
        ...current.petitionSignatures,
        { createdAt: '2026-01-02T00:00:00.000Z', petitionId: petition.id, userId: 'other-user' },
      ],
    }));

    expect((await getPetition(ctx(DEMO_USER_ID), petition.id))?.signed).toBe(false);
    expect((await getPetition(ctx('other-user'), petition.id))?.signed).toBe(true);
  });

  test('returns null for an unknown petition', async () => {
    expect(await getPetition(ctx(), 'does-not-exist')).toBeNull();
  });
});

describe('toggleSignature', () => {
  test('signing increments the count and marks the caller signed', async () => {
    const petition = seedPetition({ requiredSignatures: 5, signatureCount: 0 });

    const outcome = await toggleSignature(ctx(), petition.id);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result).toEqual({
        id: petition.id,
        justSucceeded: false,
        signatureCount: 1,
        signed: true,
        status: 'open',
      });
    }
  });

  test('signing twice in a row toggles back to unsigned -- it is a toggle, not an increment', async () => {
    const petition = seedPetition({ requiredSignatures: 5, signatureCount: 0 });

    const first = await toggleSignature(ctx(), petition.id);
    const second = await toggleSignature(ctx(), petition.id);

    expect(first.ok && first.result.signed).toBe(true);
    expect(first.ok && first.result.signatureCount).toBe(1);
    expect(second.ok && second.result.signed).toBe(false);
    expect(second.ok && second.result.signatureCount).toBe(0);
  });

  test('crossing the threshold marks the petition succeeded exactly once', async () => {
    const petition = seedPetition({ requiredSignatures: 1, signatureCount: 0 });

    const outcome = await toggleSignature(ctx(), petition.id);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.status).toBe('succeeded');
      expect(outcome.result.justSucceeded).toBe(true);
    }

    const stored = getState().petitions.find((p) => p.id === petition.id);
    expect(stored?.status).toBe('succeeded');
    expect(stored?.succeededAt).not.toBeNull();
  });

  test('rejects signing a petition that is not open', async () => {
    const petition = seedPetition({ status: 'succeeded' });

    const outcome = await toggleSignature(ctx(), petition.id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('petition_not_open');
    }
  });

  test('unsigning a petition that already succeeded is still allowed and never reverts status', async () => {
    const petition = seedPetition({ requiredSignatures: 1, signatureCount: 1, status: 'succeeded' });
    setState((current) => ({
      ...current,
      petitionSignatures: [
        ...current.petitionSignatures,
        { createdAt: '2026-01-02T00:00:00.000Z', petitionId: petition.id, userId: DEMO_USER_ID },
      ],
    }));

    const outcome = await toggleSignature(ctx(), petition.id);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.signed).toBe(false);
      expect(outcome.result.status).toBe('succeeded');
    }
  });

  test('returns petition_not_found for an unknown petition', async () => {
    const outcome = await toggleSignature(ctx(), 'does-not-exist');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('petition_not_found');
    }
  });

  test('POST /api/petitions/[id]/sign round-trips through the route', async () => {
    const petition = seedPetition({ requiredSignatures: 5 });
    const response = await postSign(new Request('http://test/sign', { method: 'POST' }), {
      id: petition.id,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { signed: boolean };
    expect(body.signed).toBe(true);
  });

  test('GET /api/petitions/[id] 404s for an unknown id', async () => {
    const response = await getPetitionRoute(new Request('http://test/x'), { id: 'nope' });
    expect(response.status).toBe(404);
  });
});

describe('reportPetition', () => {
  test('is idempotent -- reporting twice records one report', async () => {
    const petition = seedPetition();

    await reportPetition(ctx(), petition.id);
    await reportPetition(ctx(), petition.id);

    expect(
      getState().petitionReports.filter((report) => report.petitionId === petition.id),
    ).toHaveLength(1);
  });

  test('returns petition_not_found for an unknown petition', async () => {
    const result = await reportPetition(ctx(), 'does-not-exist');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('petition_not_found');
    }
  });

  test('POST /api/petitions/[id]/report round-trips through the route', async () => {
    const petition = seedPetition();
    const response = await postReport(new Request('http://test/report', { method: 'POST' }), {
      id: petition.id,
    });
    expect(response.status).toBe(200);
  });
});

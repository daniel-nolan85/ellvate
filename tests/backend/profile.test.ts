import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

import {
  GET as getProfileRoute,
  PUT as putProfileRoute,
} from '../../app/api/me/profile+api';
import { getProfile, updateProfile } from '../../src/backend/profile';
import { memoryContext } from '../../src/backend/http';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

const defaultPrefs = {
  events: true,
  replies: true,
  missions: true,
  digest: false,
};

afterEach(() => {
  setSystemTime();
  resetStore();
});

const expectFailure = (
  result: Awaited<ReturnType<typeof updateProfile>>,
  code: string,
): void => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe(code);
  }
};

describe('getProfile', () => {
  test('returns the seeded default profile for demo-user', async () => {
    expect(await getProfile(ctx())).toEqual({
      profile: {
        userId: DEMO_USER_ID,
        role: null,
        interests: [],
        aiComfort: null,
        notificationPrefs: defaultPrefs,
        onboardedAt: null,
      },
    });
  });

  test('lazily creates a default profile for an unknown user', async () => {
    expect(getState().users.some((user) => user.id === 'user-ghost')).toBe(
      false,
    );

    const { profile } = await getProfile(ctx('user-ghost'));

    expect(profile).toEqual({
      userId: 'user-ghost',
      role: null,
      interests: [],
      aiComfort: null,
      notificationPrefs: defaultPrefs,
      onboardedAt: null,
    });
    expect(getState().users.some((user) => user.id === 'user-ghost')).toBe(
      true,
    );
  });

  test('created users start off the leaderboard with no progress', async () => {
    await getProfile(ctx('user-ghost'));
    const created = getState().users.find((user) => user.id === 'user-ghost');

    expect(created).toMatchObject({
      xp: 0,
      streakDays: 0,
      missionsCompleted: 0,
      previousRank: null,
    });
  });
});

describe('updateProfile', () => {
  test('applies a partial update without touching other fields', async () => {
    const result = await updateProfile(ctx(), { role: 'resident' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.role).toBe('resident');
      expect(result.profile.interests).toEqual([]);
      expect(result.profile.aiComfort).toBeNull();
      expect(result.profile.notificationPrefs).toEqual(defaultPrefs);
      expect(result.profile.onboardedAt).toBeNull();
    }
  });

  test('persists updates to the store', async () => {
    await updateProfile(ctx(), { interests: ['Boating', 'Dining'] });

    expect((await getProfile(ctx())).profile.interests).toEqual([
      'Boating',
      'Dining',
    ]);
  });

  test('merges partial notification prefs over existing values', async () => {
    const result = await updateProfile(ctx(), {
      notificationPrefs: { digest: true },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.notificationPrefs).toEqual({
        ...defaultPrefs,
        digest: true,
      });
    }
  });

  test('rejects a non-object body', async () => {
    expectFailure(await updateProfile(ctx(), 'resident'), 'invalid_body');
    expectFailure(await updateProfile(ctx(), null), 'invalid_body');
    expectFailure(await updateProfile(ctx(), ['resident']), 'invalid_body');
  });

  test('rejects an unknown role', async () => {
    expectFailure(
      await updateProfile(ctx(), { role: 'mayor' }),
      'invalid_role',
    );
  });

  test('rejects non-array interests', async () => {
    expectFailure(
      await updateProfile(ctx(), { interests: 'Boating' }),
      'invalid_interests',
    );
  });

  test('rejects interests with non-string items', async () => {
    expectFailure(
      await updateProfile(ctx(), { interests: ['Boating', 42] }),
      'invalid_interests',
    );
  });

  test('rejects more than 12 interests', async () => {
    const interests = Array.from({ length: 13 }, (_, i) => `interest-${i}`);

    expectFailure(
      await updateProfile(ctx(), { interests }),
      'invalid_interests',
    );
  });

  test('rejects an interest longer than 40 characters', async () => {
    expectFailure(
      await updateProfile(ctx(), { interests: ['x'.repeat(41)] }),
      'invalid_interests',
    );
  });

  test('accepts 12 interests of exactly 40 characters', async () => {
    const interests = Array.from({ length: 12 }, (_, i) =>
      `${i}`.padEnd(40, 'x'),
    );

    expect((await updateProfile(ctx(), { interests })).ok).toBe(true);
  });

  test('rejects an unknown aiComfort level', async () => {
    expectFailure(
      await updateProfile(ctx(), { aiComfort: 'expert' }),
      'invalid_ai_comfort',
    );
  });

  test('rejects non-boolean notification prefs', async () => {
    expectFailure(
      await updateProfile(ctx(), { notificationPrefs: { digest: 'yes' } }),
      'invalid_notification_prefs',
    );
    expectFailure(
      await updateProfile(ctx(), { notificationPrefs: null }),
      'invalid_notification_prefs',
    );
  });

  test('a failed update does not mutate the stored profile', async () => {
    await updateProfile(ctx(), { role: 'mayor' });

    expect((await getProfile(ctx())).profile.role).toBeNull();
  });

  test('does not stamp onboardedAt until all onboarding fields are set', async () => {
    const result = await updateProfile(ctx(), {
      role: 'resident',
      interests: ['Boating', 'Dining'],
      aiComfort: 'casual',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.onboardedAt).toBeNull();
    }
  });

  test('stamps onboardedAt when role, 3+ interests, and aiComfort are set', async () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));

    const result = await updateProfile(ctx(), {
      role: 'resident',
      interests: ['Boating', 'Dining', 'Trails'],
      aiComfort: 'casual',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.onboardedAt).toBe('2026-07-12T10:00:00.000Z');
    }
  });

  test('stamps onboardedAt across incremental updates', async () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));
    await updateProfile(ctx(), { role: 'new' });
    await updateProfile(ctx(), { aiComfort: 'power' });
    expect((await getProfile(ctx())).profile.onboardedAt).toBeNull();

    await updateProfile(ctx(), { interests: ['A', 'B', 'C'] });

    expect((await getProfile(ctx())).profile.onboardedAt).toBe(
      '2026-07-12T10:00:00.000Z',
    );
  });

  test('stamps onboardedAt exactly once', async () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));
    await updateProfile(ctx(), {
      role: 'resident',
      interests: ['Boating', 'Dining', 'Trails'],
      aiComfort: 'casual',
    });

    setSystemTime(new Date('2026-07-13T09:00:00.000Z'));
    const result = await updateProfile(ctx(), {
      interests: ['Boating', 'Dining', 'Trails', 'Events'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.onboardedAt).toBe('2026-07-12T10:00:00.000Z');
    }
  });
});

describe('GET /api/me/profile', () => {
  test('returns the profile envelope for demo-user', async () => {
    const response = await getProfileRoute(
      new Request('http://localhost/api/me/profile'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: {
        userId: DEMO_USER_ID,
        role: null,
        interests: [],
        aiComfort: null,
        notificationPrefs: defaultPrefs,
        onboardedAt: null,
      },
    });
  });
});

describe('PUT /api/me/profile', () => {
  const putRequest = (body: string): Request =>
    new Request('http://localhost/api/me/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    });

  test('updates the profile and returns the envelope', async () => {
    const response = await putProfileRoute(
      putRequest(JSON.stringify({ role: 'business' })),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.role).toBe('business');
    expect(body.profile.userId).toBe(DEMO_USER_ID);
  });

  test('returns 400 for a malformed JSON body', async () => {
    const response = await putProfileRoute(putRequest('not-json'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'invalid_json',
      message: 'Request body must be valid JSON.',
    });
  });

  test('returns 400 with the validation code for invalid fields', async () => {
    const response = await putProfileRoute(
      putRequest(JSON.stringify({ role: 'mayor' })),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('invalid_role');
  });
});

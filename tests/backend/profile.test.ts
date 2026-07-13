import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

import {
  GET as getProfileRoute,
  PUT as putProfileRoute,
} from '../../app/api/me/profile+api';
import { getProfile, updateProfile } from '../../src/backend/profile';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

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
  result: ReturnType<typeof updateProfile>,
  code: string,
): void => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe(code);
  }
};

describe('getProfile', () => {
  test('returns the seeded default profile for demo-user', () => {
    expect(getProfile(DEMO_USER_ID)).toEqual({
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

  test('lazily creates a default profile for an unknown user', () => {
    expect(getState().users.some((user) => user.id === 'user-ghost')).toBe(
      false,
    );

    const { profile } = getProfile('user-ghost');

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

  test('created users start off the leaderboard with no progress', () => {
    getProfile('user-ghost');
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
  test('applies a partial update without touching other fields', () => {
    const result = updateProfile(DEMO_USER_ID, { role: 'resident' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.role).toBe('resident');
      expect(result.profile.interests).toEqual([]);
      expect(result.profile.aiComfort).toBeNull();
      expect(result.profile.notificationPrefs).toEqual(defaultPrefs);
      expect(result.profile.onboardedAt).toBeNull();
    }
  });

  test('persists updates to the store', () => {
    updateProfile(DEMO_USER_ID, { interests: ['Boating', 'Dining'] });

    expect(getProfile(DEMO_USER_ID).profile.interests).toEqual([
      'Boating',
      'Dining',
    ]);
  });

  test('merges partial notification prefs over existing values', () => {
    const result = updateProfile(DEMO_USER_ID, {
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

  test('rejects a non-object body', () => {
    expectFailure(updateProfile(DEMO_USER_ID, 'resident'), 'invalid_body');
    expectFailure(updateProfile(DEMO_USER_ID, null), 'invalid_body');
    expectFailure(updateProfile(DEMO_USER_ID, ['resident']), 'invalid_body');
  });

  test('rejects an unknown role', () => {
    expectFailure(updateProfile(DEMO_USER_ID, { role: 'mayor' }), 'invalid_role');
  });

  test('rejects non-array interests', () => {
    expectFailure(
      updateProfile(DEMO_USER_ID, { interests: 'Boating' }),
      'invalid_interests',
    );
  });

  test('rejects interests with non-string items', () => {
    expectFailure(
      updateProfile(DEMO_USER_ID, { interests: ['Boating', 42] }),
      'invalid_interests',
    );
  });

  test('rejects more than 12 interests', () => {
    const interests = Array.from({ length: 13 }, (_, i) => `interest-${i}`);

    expectFailure(
      updateProfile(DEMO_USER_ID, { interests }),
      'invalid_interests',
    );
  });

  test('rejects an interest longer than 40 characters', () => {
    expectFailure(
      updateProfile(DEMO_USER_ID, { interests: ['x'.repeat(41)] }),
      'invalid_interests',
    );
  });

  test('accepts 12 interests of exactly 40 characters', () => {
    const interests = Array.from({ length: 12 }, (_, i) =>
      `${i}`.padEnd(40, 'x'),
    );

    expect(updateProfile(DEMO_USER_ID, { interests }).ok).toBe(true);
  });

  test('rejects an unknown aiComfort level', () => {
    expectFailure(
      updateProfile(DEMO_USER_ID, { aiComfort: 'expert' }),
      'invalid_ai_comfort',
    );
  });

  test('rejects non-boolean notification prefs', () => {
    expectFailure(
      updateProfile(DEMO_USER_ID, { notificationPrefs: { digest: 'yes' } }),
      'invalid_notification_prefs',
    );
    expectFailure(
      updateProfile(DEMO_USER_ID, { notificationPrefs: null }),
      'invalid_notification_prefs',
    );
  });

  test('a failed update does not mutate the stored profile', () => {
    updateProfile(DEMO_USER_ID, { role: 'mayor' });

    expect(getProfile(DEMO_USER_ID).profile.role).toBeNull();
  });

  test('does not stamp onboardedAt until all onboarding fields are set', () => {
    const result = updateProfile(DEMO_USER_ID, {
      role: 'resident',
      interests: ['Boating', 'Dining'],
      aiComfort: 'casual',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.onboardedAt).toBeNull();
    }
  });

  test('stamps onboardedAt when role, 3+ interests, and aiComfort are set', () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));

    const result = updateProfile(DEMO_USER_ID, {
      role: 'resident',
      interests: ['Boating', 'Dining', 'Trails'],
      aiComfort: 'casual',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.onboardedAt).toBe('2026-07-12T10:00:00.000Z');
    }
  });

  test('stamps onboardedAt across incremental updates', () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));
    updateProfile(DEMO_USER_ID, { role: 'new' });
    updateProfile(DEMO_USER_ID, { aiComfort: 'power' });
    expect(getProfile(DEMO_USER_ID).profile.onboardedAt).toBeNull();

    updateProfile(DEMO_USER_ID, { interests: ['A', 'B', 'C'] });

    expect(getProfile(DEMO_USER_ID).profile.onboardedAt).toBe(
      '2026-07-12T10:00:00.000Z',
    );
  });

  test('stamps onboardedAt exactly once', () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));
    updateProfile(DEMO_USER_ID, {
      role: 'resident',
      interests: ['Boating', 'Dining', 'Trails'],
      aiComfort: 'casual',
    });

    setSystemTime(new Date('2026-07-13T09:00:00.000Z'));
    const result = updateProfile(DEMO_USER_ID, {
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

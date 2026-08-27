import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

import {
  GET as getProfileRoute,
  PUT as putProfileRoute,
} from '../../app/api/me/profile+api';
import { GET as getMemberProfileRoute } from '../../app/api/users/[userId]/profile+api';
import { toggleJoin } from '../../src/backend/events';
import {
  getProfile,
  getPublicProfile,
  updateProfile,
} from '../../src/backend/profile';
import { memoryContext } from '../../src/backend/http';
import {
  defaultDisplayName,
  DEMO_USER_ID,
  getState,
  resetStore,
} from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

const defaultPrefs = {
  events: true,
  replies: true,
  missions: true,
  digest: true,
  petitions: true,
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
        name: 'You',
        avatarUrl: null,
        role: null,
        interests: [],
        notificationPrefs: defaultPrefs,
        onboardedAt: null,
        activityVisible: false,
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
      name: defaultDisplayName('user-ghost'),
      avatarUrl: null,
      role: null,
      interests: [],
      notificationPrefs: defaultPrefs,
      onboardedAt: null,
      activityVisible: false,
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

describe('getPublicProfile (requester differs from member)', () => {
  test('returns the member’s own profile and stats without creating a requester-owned row', async () => {
    const summary = await getPublicProfile(ctx(), 'user-mia');

    expect(summary).not.toBeNull();
    expect(summary?.profile).toEqual({
      userId: 'user-mia',
      name: 'Mia Lake',
      avatarUrl: null,
      role: null,
      interests: [],
      activityVisible: false,
    });
    expect(summary?.stats).toMatchObject({
      xp: 3820,
      streakDays: 0,
      missionsCompleted: 41,
    });

    // The requester's own row must be untouched — no ghost row created for
    // the member (the member already exists), and no side effect on the
    // requester's own record either.
    expect(
      getState().users.filter((user) => user.id === 'user-mia'),
    ).toHaveLength(1);
  });

  test('reports activity counts: posts written, events/missions created, events attended', async () => {
    // Seed: user-mia authored post-3 and event-2, created no missions, and
    // hasn't joined anything yet (all seeded events start with joinedBy: []).
    const before = await getPublicProfile(ctx(), 'user-mia');
    expect(before?.stats).toMatchObject({
      postsCount: 1,
      eventsCreated: 1,
      eventsAttended: 0,
      missionsCreated: 0,
    });

    await toggleJoin(ctx('user-mia'), 'event-1');
    const after = await getPublicProfile(ctx(), 'user-mia');
    expect(after?.stats).toMatchObject({
      postsCount: 1,
      eventsCreated: 1,
      eventsAttended: 1,
      missionsCreated: 0,
    });
  });

  test('returns null for an unknown member and creates no ghost user', async () => {
    expect(getState().users.some((user) => user.id === 'user-ghost')).toBe(
      false,
    );

    const summary = await getPublicProfile(ctx(), 'user-ghost');

    expect(summary).toBeNull();
    expect(getState().users.some((user) => user.id === 'user-ghost')).toBe(
      false,
    );
  });

  test('surfaces the member’s own activityVisible choice, not the requester’s', async () => {
    expect((await getPublicProfile(ctx(), 'user-mia'))?.profile.activityVisible).toBe(
      false,
    );

    await updateProfile(ctx('user-mia'), { activityVisible: true });

    expect((await getPublicProfile(ctx(), 'user-mia'))?.profile.activityVisible).toBe(
      true,
    );
  });
});

describe('GET /api/users/:userId/profile', () => {
  test('returns the member profile envelope', async () => {
    const response = await getMemberProfileRoute(
      new Request('http://localhost/api/users/user-mia/profile'),
      { userId: 'user-mia' },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      profile: { name: string; userId: string };
    };
    expect(body.profile).toMatchObject({ name: 'Mia Lake', userId: 'user-mia' });
  });

  test('returns 404 for an unknown member', async () => {
    const response = await getMemberProfileRoute(
      new Request('http://localhost/api/users/user-ghost/profile'),
      { userId: 'user-ghost' },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 'member_not_found',
      message: 'Member not found.',
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

  test('updates and round-trips the display name', async () => {
    const result = await updateProfile(ctx(), { name: 'Danny' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.name).toBe('Danny');
    }
    expect((await getProfile(ctx())).profile.name).toBe('Danny');
  });

  test('leaves the name untouched when not included in the update', async () => {
    await updateProfile(ctx(), { name: 'Danny' });

    const result = await updateProfile(ctx(), { role: 'resident' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.name).toBe('Danny');
    }
  });

  test('merges partial notification prefs over existing values', async () => {
    const result = await updateProfile(ctx(), {
      notificationPrefs: { digest: false },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.notificationPrefs).toEqual({
        ...defaultPrefs,
        digest: false,
      });
    }
  });

  test('defaults activityVisible to false and round-trips it on update', async () => {
    expect((await getProfile(ctx())).profile.activityVisible).toBe(false);

    const shared = await updateProfile(ctx(), { activityVisible: true });
    expect(shared.ok).toBe(true);
    if (shared.ok) {
      expect(shared.profile.activityVisible).toBe(true);
    }
    expect((await getProfile(ctx())).profile.activityVisible).toBe(true);

    const hidden = await updateProfile(ctx(), { activityVisible: false });
    expect(hidden.ok).toBe(true);
    if (hidden.ok) {
      expect(hidden.profile.activityVisible).toBe(false);
    }
  });

  test('rejects a non-boolean activityVisible', async () => {
    expectFailure(
      await updateProfile(ctx(), { activityVisible: 'yes' }),
      'invalid_activity_visible',
    );
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
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.onboardedAt).toBeNull();
    }
  });

  test('stamps onboardedAt when role and 3+ interests are set', async () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));

    const result = await updateProfile(ctx(), {
      role: 'resident',
      interests: ['Boating', 'Dining', 'Trails'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.onboardedAt).toBe('2026-07-12T10:00:00.000Z');
    }
  });

  test('stamps onboardedAt across incremental updates', async () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));
    await updateProfile(ctx(), { role: 'new' });
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

describe('avatar upload', () => {
  const AVATAR_DATA_URL = 'data:image/jpeg;base64,ZmFrZS1hdmF0YXItYnl0ZXM=';

  test('sets avatarUrl from an uploaded data URL', async () => {
    const result = await updateProfile(ctx(), {
      avatar: { dataUrl: AVATAR_DATA_URL, filename: 'me.jpg' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.avatarUrl).toBe(AVATAR_DATA_URL);
    }
    expect(
      getState().users.find((user) => user.id === DEMO_USER_ID)?.avatarUrl,
    ).toBe(AVATAR_DATA_URL);
  });

  test('leaves avatarUrl untouched when no avatar is included in the update', async () => {
    await updateProfile(ctx(), {
      avatar: { dataUrl: AVATAR_DATA_URL, filename: 'me.jpg' },
    });

    const result = await updateProfile(ctx(), { role: 'resident' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.avatarUrl).toBe(AVATAR_DATA_URL);
    }
  });

  test('ignores a malformed avatar payload without a data URL', async () => {
    const result = await updateProfile(ctx(), {
      avatar: { dataUrl: 'not-a-data-url', filename: 'me.jpg' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.avatarUrl).toBeNull();
    }
  });

  test('propagates the new avatar to the public member profile', async () => {
    await updateProfile(ctx('user-mia'), {
      avatar: { dataUrl: AVATAR_DATA_URL, filename: 'me.jpg' },
    });

    const summary = await getPublicProfile(ctx(), 'user-mia');

    expect(summary?.profile.avatarUrl).toBe(AVATAR_DATA_URL);
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
        name: 'You',
        avatarUrl: null,
        role: null,
        interests: [],
        notificationPrefs: defaultPrefs,
        onboardedAt: null,
        activityVisible: false,
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

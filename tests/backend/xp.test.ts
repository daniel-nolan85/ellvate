import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { GET as getXpLedgerRoute } from '../../app/api/me/xp-ledger+api';
import { createEvent } from '../../src/backend/events';
import { createPost } from '../../src/backend/forum';
import { memoryContext } from '../../src/backend/http';
import { checkIn, createMission, getUserProgress } from '../../src/backend/missions';
import { updateProfile } from '../../src/backend/profile';
import { createServiceListing } from '../../src/backend/services';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';
import { CREATE_CONTENT_XP, getXpLedger } from '../../src/backend/xp';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

// A real photo of a person -- the face-detection gate (src/services/face-
// detection) rejects anything it can't find a face in, so a placeholder
// data URL no longer completes a mission. Reused from @vladmandic/face-api's
// own bundled demo assets (the package this gate runs on) rather than
// committing a new binary fixture to this repo.
const CHECK_IN_PHOTO = {
  checkInPhoto: {
    dataUrl: `data:image/jpeg;base64,${readFileSync(
      require.resolve('@vladmandic/face-api/demo/sample1.jpg'),
    ).toString('base64')}`,
    filename: 'proof.jpg',
  },
};

afterEach(() => {
  setSystemTime();
  resetStore();
});

const futureDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

describe('XP grants for creating content', () => {
  test('creating a mission grants CREATE_CONTENT_XP and records a ledger entry', async () => {
    const before = (await getUserProgress(ctx())).xp;

    const result = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect((await getUserProgress(ctx())).xp).toBe(before + CREATE_CONTENT_XP);

    const ledger = await getXpLedger(ctx(), {});
    expect(ledger.entries[0]).toMatchObject({
      amount: CREATE_CONTENT_XP,
      reason: 'mission_created',
      refId: result.mission.id,
    });
  });

  test('an invalid mission grants no XP and records no ledger entry', async () => {
    const before = (await getUserProgress(ctx())).xp;

    const result = await createMission(ctx(), { title: '' });
    expect(result.ok).toBe(false);

    expect((await getUserProgress(ctx())).xp).toBe(before);
    expect((await getXpLedger(ctx(), {})).entries).toHaveLength(0);
  });

  test('creating a post grants CREATE_CONTENT_XP and records a ledger entry', async () => {
    const before = (await getUserProgress(ctx())).xp;

    const result = await createPost(ctx(), {
      excerpt: 'Anyone in?',
      forum: 'Dining',
      title: 'Taco night?',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect((await getUserProgress(ctx())).xp).toBe(before + CREATE_CONTENT_XP);

    const ledger = await getXpLedger(ctx(), {});
    expect(ledger.entries[0]).toMatchObject({
      amount: CREATE_CONTENT_XP,
      reason: 'post_created',
      refId: result.post.id,
    });
  });

  test('creating an event grants CREATE_CONTENT_XP and records a ledger entry', async () => {
    const before = (await getUserProgress(ctx())).xp;

    const result = await createEvent(ctx(), {
      date: futureDate(30),
      place: 'Village Marina',
      tag: 'Outdoors',
      time: '18:00',
      title: 'Sunset Kayak',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect((await getUserProgress(ctx())).xp).toBe(before + CREATE_CONTENT_XP);

    const ledger = await getXpLedger(ctx(), {});
    expect(ledger.entries[0]).toMatchObject({
      amount: CREATE_CONTENT_XP,
      reason: 'event_created',
      refId: result.event.id,
    });
  });

  test('creating a service listing grants CREATE_CONTENT_XP and records a ledger entry', async () => {
    const before = (await getUserProgress(ctx())).xp;

    const result = await createServiceListing(ctx(), {
      businessName: 'Test Yard Care',
      category: 'home-services',
      contactEmail: '',
      contactPhone: '(702) 555-0100',
      contactWebsite: '',
      description: 'Mowing, edging, and cleanup.',
      serviceArea: 'Lake Las Vegas',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect((await getUserProgress(ctx())).xp).toBe(before + CREATE_CONTENT_XP);

    const ledger = await getXpLedger(ctx(), {});
    expect(ledger.entries[0]).toMatchObject({
      amount: CREATE_CONTENT_XP,
      reason: 'service_created',
      refId: result.listing.id,
    });
  });
});

describe('XP ledger for mission completion', () => {
  test('completing a mission records a mission_completed entry for the mission XP', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    // Creating the mission itself logs a mission_created entry -- clear the
    // slate so this test only has to reason about the completion entry.
    resetStore();
    const recreated = await createMission(ctx('user-hoa'), {
      description: 'Rent a kayak and get on the water.',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!recreated.ok) {
      throw new Error('setup failed');
    }

    const result = await checkIn(ctx(), recreated.mission.id, CHECK_IN_PHOTO);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.body.awardedXp).toBe(75);

    const ledger = await getXpLedger(ctx(), {});
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({
      amount: 75,
      reason: 'mission_completed',
      refId: recreated.mission.id,
    });
  });

  test('an in-progress (non-completing) check-in records no ledger entry', async () => {
    const created = await createMission(ctx('user-hoa'), {
      description: 'Two-stop mission.',
      stops: ['Stop 1', 'Stop 2'],
      title: 'Two Stops',
      xp: 40,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    resetStore();
    const recreated = await createMission(ctx('user-hoa'), {
      description: 'Two-stop mission.',
      stops: ['Stop 1', 'Stop 2'],
      title: 'Two Stops',
      xp: 40,
    });
    if (!recreated.ok) {
      throw new Error('setup failed');
    }

    const result = await checkIn(ctx(), recreated.mission.id);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.body.awardedXp).toBe(0);

    const ledger = await getXpLedger(ctx(), {});
    expect(ledger.entries).toHaveLength(0);
  });
});

describe('XP ledger for the onboarding bonus', () => {
  test('completing onboarding records exactly one onboarding_bonus entry', async () => {
    await updateProfile(ctx(), {
      interests: ['Boating', 'Dining', 'Trails'],
      role: 'resident',
    });
    // A later, unrelated update must not grant (or log) the bonus again.
    await updateProfile(ctx(), { name: 'Renamed' });

    const ledger = await getXpLedger(ctx(), { reasons: ['onboarding_bonus'] });
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]?.amount).toBe(50);
  });
});

describe('getXpLedger', () => {
  test('paginates newest-first and filters by reason', async () => {
    setSystemTime(new Date('2026-07-12T10:00:00.000Z'));
    await createPost(ctx(), { excerpt: 'e', forum: 'Dining', title: 'Post A' });
    setSystemTime(new Date('2026-07-12T10:00:01.000Z'));
    await createPost(ctx(), { excerpt: 'e', forum: 'Dining', title: 'Post B' });
    setSystemTime(new Date('2026-07-12T10:00:02.000Z'));
    const mission = await createMission(ctx(), {
      description: 'd',
      stops: ['Stop 1'],
      title: 'Mission A',
      xp: 30,
    });
    if (!mission.ok) {
      throw new Error('setup failed');
    }

    const firstPage = await getXpLedger(ctx(), { limit: 2 });
    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(firstPage.entries[0]?.reason).toBe('mission_created');

    const secondPage = await getXpLedger(ctx(), {
      cursor: firstPage.nextCursor,
      limit: 2,
    });
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();

    const postsOnly = await getXpLedger(ctx(), { reasons: ['post_created'] });
    expect(postsOnly.entries).toHaveLength(2);
    expect(postsOnly.entries.every((entry) => entry.reason === 'post_created')).toBe(
      true,
    );
  });

  test('GET /api/me/xp-ledger returns the caller’s own entries', async () => {
    await createPost(ctx(), { excerpt: 'e', forum: 'Dining', title: 'Post A' });

    const response = await getXpLedgerRoute(
      new Request('http://localhost/api/me/xp-ledger'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      entries: readonly { reason: string }[];
      nextCursor: string | null;
    };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.reason).toBe('post_created');
  });

  test('is scoped to the caller -- a different user sees none of this', async () => {
    await createPost(ctx(), { excerpt: 'e', forum: 'Dining', title: 'Post A' });

    const other = await getXpLedger(ctx('user-mia'), {});
    expect(other.entries).toHaveLength(0);
    expect(getState().xpLedger).toHaveLength(1);
  });
});

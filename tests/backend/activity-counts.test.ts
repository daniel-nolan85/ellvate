import { afterEach, describe, expect, test } from 'bun:test';

import { getMyActivityCounts } from '../../src/backend/activity';
import { createEvent, toggleJoin } from '../../src/backend/events';
import { createPost } from '../../src/backend/forum';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { checkIn, createMission } from '../../src/backend/missions';
import { toggleSignature } from '../../src/backend/petitions';
import { createServiceListing } from '../../src/backend/services';
import { resetStore, setState } from '../../src/backend/store';
import type { StoredPetition } from '../../src/backend/store';

const ctx = (userId: string) => memoryContext(userId);
const TEST_USER = 'user-activity-counts';

const futureDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

describe('getMyActivityCounts (memory)', () => {
  test('counts every kind as true totals, not just what a paginated list has loaded', async () => {
    const ownPost = await createPost(ctx(TEST_USER), {
      excerpt: 'Selling a kayak, barely used.',
      forum: 'Buy & Sell',
      title: 'Kayak for sale',
    });
    if (!ownPost.ok) throw new Error('setup failed: post');

    const ownEventOne = await createEvent(ctx(TEST_USER), {
      date: futureDate(10),
      place: 'Village Marina',
      tag: 'Outdoors',
      time: '18:00',
      title: 'Sunset Kayak',
    });
    if (!ownEventOne.ok) throw new Error('setup failed: event one');
    const ownEventTwo = await createEvent(ctx(TEST_USER), {
      date: futureDate(20),
      place: 'Clubhouse',
      tag: 'Social',
      time: '12:00',
      title: 'Potluck',
    });
    if (!ownEventTwo.ok) throw new Error('setup failed: event two');

    // Joining your own event must never count toward "attending" -- only
    // someone else's event, joined, should.
    await toggleJoin(ctx(TEST_USER), ownEventOne.event.id);
    await toggleJoin(ctx(TEST_USER), 'event-2');

    const ownMission = await createMission(ctx(TEST_USER), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-09-18',
      stops: ['Stop 1', 'Stop 2', 'Stop 3'],
      title: 'Kayak the marina',
      xp: 75,
    });
    if (!ownMission.ok) throw new Error('setup failed: mission');
    // Completing someone else's mission.
    await checkIn(ctx(TEST_USER), 'mission-1');

    const ownListing = await createServiceListing(ctx(TEST_USER), {
      businessName: 'Lake Las Vegas Yard Care',
      category: 'home-services',
      contactEmail: '',
      contactPhone: '(702) 555-0199',
      contactWebsite: '',
      description: 'Mowing, edging, and cleanup.',
      serviceArea: 'Lake Las Vegas',
    });
    if (!ownListing.ok) throw new Error('setup failed: listing');

    // A petition the user created (seeded directly -- createPetition is
    // gated behind the community-size unlock, same shortcut
    // delete-account.test.ts's own fixture uses) plus one they merely
    // signed, to exercise the created-or-signed union.
    const ownPetition: StoredPetition = {
      category: 'safety',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: TEST_USER,
      deadlineAt: '2026-12-31T00:00:00.000Z',
      deadlineDays: 30,
      description: 'A description of the issue.',
      hoaEmailSentAt: null,
      hoaResponse: null,
      hoaResponseAt: null,
      id: 'petition-activity-counts-own',
      requiredSignatures: 5,
      signatureCount: 0,
      status: 'open',
      succeededAt: null,
      title: 'Activity counts test petition',
    };
    setState((current) => ({ ...current, petitions: [...current.petitions, ownPetition] }));
    await toggleSignature(ctx(TEST_USER), 'petition-marina-lighting');

    const counts = await getMyActivityCounts(ctx(TEST_USER));

    expect(counts.postsCount).toBe(1);
    expect(counts.eventsCreatedCount).toBe(2);
    expect(counts.eventsAttendingCount).toBe(1);
    expect(counts.missionsCreatedCount).toBe(1);
    expect(counts.missionsCompletedCount).toBe(1);
    expect(counts.servicesCount).toBe(1);
    expect(counts.petitionsCount).toBe(2);
  });
});

import { afterEach, describe, expect, test } from 'bun:test';

import { DELETE as deleteAccountRoute } from '../../app/api/me/account+api';
import { deleteAccount } from '../../src/backend/account';
import { listBookmarks, toggleBookmark } from '../../src/backend/bookmarks';
import { createComment, listComments } from '../../src/backend/comments';
import { createEventComment, listEventComments } from '../../src/backend/event-comments';
import { createEvent, getEventsView, toggleJoin } from '../../src/backend/events';
import { createPost, togglePin, toggleLike } from '../../src/backend/forum';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { createMissionComment, listMissionComments } from '../../src/backend/mission-comments';
import { checkIn, createMission, getMissionsView } from '../../src/backend/missions';
import { getMutedUserIds, toggleMute } from '../../src/backend/mutes';
import { createPetitionComment, listPetitionComments } from '../../src/backend/petition-comments';
import { listPetitionsPage, toggleSignature } from '../../src/backend/petitions';
import { createServiceReview, listServiceReviews } from '../../src/backend/service-reviews';
import { createServiceListing } from '../../src/backend/services';
import { DEMO_USER_ID, getState, resetStore, setState } from '../../src/backend/store';
import type { StoredPetition } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);
const TEST_USER = 'user-delete-me';

const eventInput = {
  date: '2026-09-18',
  place: 'Village Marina',
  tag: 'Outdoors',
  time: '18:00',
  title: 'Sunset Kayak',
} as const;

const missionInput = {
  description: 'Rent a kayak and get on the water.',
  theme: 'day',
  scheduledFor: '2026-09-18',
  stops: ['Stop 1', 'Stop 2', 'Stop 3'],
  title: 'Kayak the marina',
  xp: 75,
} as const;

const listingInput = {
  businessName: 'Delete Me Yard Care',
  category: 'home-services',
  contactEmail: '',
  contactPhone: '(702) 555-0199',
  contactWebsite: '',
  description: 'Mowing, edging, and cleanup.',
  serviceArea: 'Lake Las Vegas',
} as const;

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

describe('deleteAccount (memory)', () => {
  test('removes everything the account owns, orphans what it created, and cleans up references from other users', async () => {
    // Own content: post, event, mission, service listing (+ a review on it
    // from someone else, to prove deleteServiceListing's own cascade still
    // runs as part of the flow).
    const ownPost = await createPost(ctx(TEST_USER), {
      excerpt: 'Selling a kayak, barely used.',
      forum: 'Buy & Sell',
      title: 'Kayak for sale',
    });
    if (!ownPost.ok) throw new Error('setup failed: post');
    const ownEvent = await createEvent(ctx(TEST_USER), eventInput);
    if (!ownEvent.ok) throw new Error('setup failed: event');
    const ownMission = await createMission(ctx(TEST_USER), missionInput);
    if (!ownMission.ok) throw new Error('setup failed: mission');
    const ownListing = await createServiceListing(ctx(TEST_USER), listingInput);
    if (!ownListing.ok) throw new Error('setup failed: listing');
    const reviewOnOwnListing = await createServiceReview(
      ctx('user-mia'),
      ownListing.listing.id,
      { body: 'Great job!', rating: 5 },
    );
    if (!reviewOnOwnListing.ok) throw new Error('setup failed: review');
    // Petitions can't be created via createPetition below the community-size
    // unlock threshold, so this seeds one directly -- same shortcut the
    // petitions test suite's own seedPetition fixture uses.
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
      id: 'petition-delete-test-own',
      requiredSignatures: 5,
      signatureCount: 0,
      status: 'open',
      succeededAt: null,
      title: 'Delete-me test petition',
    };
    setState((current) => ({ ...current, petitions: [...current.petitions, ownPetition] }));

    // Activity on OTHER people's content.
    const commentOnOthersPost = await createComment(ctx(TEST_USER), 'post-1', {
      body: 'Nice find!',
    });
    if (!commentOnOthersPost.ok) throw new Error('setup failed: comment');
    await toggleLike(ctx(TEST_USER), 'post-1');
    const commentOnOthersEvent = await createEventComment(ctx(TEST_USER), 'event-1', {
      body: 'See you there!',
    });
    if (!commentOnOthersEvent.ok) throw new Error('setup failed: event comment');
    await toggleJoin(ctx(TEST_USER), 'event-2');
    const commentOnOthersMission = await createMissionComment(
      ctx(TEST_USER),
      'mission-1',
      { body: 'Good luck everyone' },
    );
    if (!commentOnOthersMission.ok) throw new Error('setup failed: mission comment');
    await checkIn(ctx(TEST_USER), 'mission-1');
    const ownReviewOnOthersListing = await createServiceReview(
      ctx(TEST_USER),
      'service-1',
      { body: 'Would recommend.', rating: 4 },
    );
    if (!ownReviewOnOthersListing.ok) throw new Error('setup failed: own review');
    const commentOnOthersPetition = await createPetitionComment(
      ctx(TEST_USER),
      'petition-marina-lighting',
      { body: 'Signed and commenting!' },
    );
    if (!commentOnOthersPetition.ok) throw new Error('setup failed: petition comment');
    await toggleSignature(ctx(TEST_USER), 'petition-marina-lighting');
    await toggleMute(ctx(TEST_USER), 'user-mia');
    await toggleMute(ctx('user-mia'), TEST_USER);
    await toggleBookmark(ctx(TEST_USER), { targetId: 'post-1', targetType: 'post' });
    await togglePin(ctx('user-mia'), ownPost.post.id);

    // Sanity: everything set up before deletion actually landed.
    expect(getState().users.some((user) => user.id === TEST_USER)).toBe(true);
    expect(
      getState().users.find((user) => user.id === 'user-mia')?.pinnedPostId,
    ).toBe(ownPost.post.id);

    const before = getState().posts.find((post) => post.id === 'post-1');

    await deleteAccount(ctx(TEST_USER));

    // The account itself is gone.
    expect(getState().users.some((user) => user.id === TEST_USER)).toBe(false);

    // Own content the user authored outright is deleted.
    expect(getState().posts.some((post) => post.id === ownPost.post.id)).toBe(false);
    expect(
      getState().serviceListings.some((listing) => listing.id === ownListing.listing.id),
    ).toBe(false);
    // ...and its cascade (the review someone else left) went with it.
    expect(
      (await listServiceReviews(ctx(), ownListing.listing.id)).some(
        (review) => review.id === reviewOnOwnListing.review.id,
      ),
    ).toBe(false);

    // Own activity on others' content is removed.
    expect(
      (await listComments(ctx(), 'post-1')).some(
        (comment) => comment.id === commentOnOthersPost.comment.id,
      ),
    ).toBe(false);
    // `before` was captured after this test's own like, so deleting the
    // account (which un-likes it) should bring the count back down by one.
    expect(getState().posts.find((post) => post.id === 'post-1')?.likes).toBe(
      (before?.likes ?? 0) - 1,
    );
    expect(
      (await listEventComments(ctx(), 'event-1')).some(
        (comment) => comment.id === commentOnOthersEvent.comment.id,
      ),
    ).toBe(false);
    expect(
      getState().events.find((event) => event.id === 'event-2')?.joinedBy,
    ).not.toContain(TEST_USER);
    expect(
      (await listMissionComments(ctx(), 'mission-1')).some(
        (comment) => comment.id === commentOnOthersMission.comment.id,
      ),
    ).toBe(false);
    expect(
      getState().missions.find((mission) => mission.id === 'mission-1')
        ?.progressByUser[TEST_USER],
    ).toBeUndefined();
    expect(
      (await listServiceReviews(ctx(), 'service-1')).some(
        (review) => review.id === ownReviewOnOthersListing.review.id,
      ),
    ).toBe(false);
    expect(
      (await listPetitionComments(ctx(), 'petition-marina-lighting')).some(
        (comment) => comment.id === commentOnOthersPetition.comment.id,
      ),
    ).toBe(false);
    expect(
      getState().petitionSignatures.some(
        (signature) =>
          signature.petitionId === 'petition-marina-lighting' &&
          signature.userId === TEST_USER,
      ),
    ).toBe(false);
    expect(
      (await listBookmarks(ctx(TEST_USER))).items.some(
        (item) => item.kind === 'post' && item.post.id === 'post-1',
      ),
    ).toBe(false);

    // Content the user created but didn't fully own the lifecycle of
    // (events/missions others may have joined/progressed) is orphaned, not
    // deleted — it stays visible with a "Former member" author.
    const eventsAfter = await getEventsView(ctx());
    const orphanedEvent = eventsAfter.events.find((event) => event.id === ownEvent.event.id);
    expect(orphanedEvent).toBeDefined();
    expect(orphanedEvent?.author).toEqual({
      avatarUrl: null,
      id: TEST_USER,
      isAdmin: false,
      name: 'Former member',
    });

    const missionsAfter = await getMissionsView(ctx());
    const orphanedMission = missionsAfter.missions.find(
      (mission) => mission.id === ownMission.mission.id,
    );
    expect(orphanedMission).toBeDefined();
    expect(orphanedMission?.author).toEqual({
      avatarUrl: null,
      id: TEST_USER,
      isAdmin: false,
      name: 'Former member',
    });

    const petitionsAfter = await listPetitionsPage(ctx(), { limit: 50, status: 'open' });
    const orphanedPetition = petitionsAfter.petitions.find(
      (petition) => petition.id === ownPetition.id,
    );
    expect(orphanedPetition).toBeDefined();
    expect(orphanedPetition?.createdBy).toEqual({
      avatarUrl: null,
      id: TEST_USER,
      isAdmin: false,
      name: 'Former member',
    });

    // References from OTHER users are cleaned up too: their mute of the
    // deleted account, and their pin of a now-deleted post.
    expect(await getMutedUserIds(ctx('user-mia'))).not.toContain(TEST_USER);
    expect(
      getState().users.find((user) => user.id === 'user-mia')?.pinnedPostId,
    ).toBeNull();

    // Notifications addressed to the deleted account are gone too.
    expect(
      getState().notifications.some(
        (notification) => notification.userId === TEST_USER,
      ),
    ).toBe(false);
  });

  test('is a no-op-safe call for a brand-new user with nothing to clean up', async () => {
    await expect(deleteAccount(ctx('user-nothing-owned'))).resolves.toBeUndefined();
    expect(getState().users.some((user) => user.id === 'user-nothing-owned')).toBe(
      false,
    );
  });
});

describe('DELETE /api/me/account', () => {
  test('deletes the demo user and returns a confirmation', async () => {
    expect(getState().users.some((user) => user.id === DEMO_USER_ID)).toBe(true);

    const response = await deleteAccountRoute(
      new Request('http://localhost/api/me/account', { method: 'DELETE' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(getState().users.some((user) => user.id === DEMO_USER_ID)).toBe(false);
  });
});

import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getSearchRoute } from '../../app/api/search+api';
import { memoryContext } from '../../src/backend/http';
import { searchAll } from '../../src/backend/search';
import { toggleMute } from '../../src/backend/mutes';
import {
  DEMO_USER_ID,
  resetStore,
  setState,
  type StoredEvent,
  type StoredMission,
  type StoredPetition,
  type StoredPost,
  type StoredServiceListing,
} from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

// A substring guaranteed not to appear in any seed fixture, so every
// assertion below can search this exact term without needing to know (or
// keep in sync with) the seed data's real titles.
const NEEDLE = 'zzyzxlagoon';

afterEach(() => {
  resetStore();
});

function seedMatchingContent(authorId: string = DEMO_USER_ID): void {
  const post: StoredPost = {
    authorId,
    createdAt: '2026-01-01T00:00:00.000Z',
    editedAt: null,
    excerpt: 'A post about it.',
    forum: 'General',
    id: 'fixture-post-search',
    likedBy: [],
    likes: 0,
    replies: 0,
    title: `Fix the ${NEEDLE} walkway`,
  };
  const event: StoredEvent = {
    attendeeIds: [],
    authorId,
    dateLabel: 'Jan 1',
    dayLabel: 'Thursday',
    editedAt: null,
    featured: false,
    going: 0,
    id: 'fixture-event-search',
    joinedBy: [],
    place: 'Marina',
    startsAt: '2026-01-01T18:00:00.000Z',
    tag: 'Social',
    timeLabel: '6:00 PM',
    title: `${NEEDLE} cleanup day`,
  };
  const mission: StoredMission = {
    authorId,
    description: 'Pick up litter.',
    editedAt: null,
    id: 'fixture-mission-search',
    progressByUser: {},
    scheduledFor: null,
    stops: ['Start'],
    stopsTotal: 1,
    theme: 'community',
    title: `${NEEDLE} mission`,
    xp: 10,
  };
  const service: StoredServiceListing = {
    authorId,
    businessName: `${NEEDLE} Landscaping`,
    category: 'other',
    contactEmail: null,
    contactPhone: null,
    contactWebsite: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    description: 'We mow lawns.',
    editedAt: null,
    hours: null,
    id: 'fixture-service-search',
    serviceArea: null,
  };
  const petition: StoredPetition = {
    category: 'maintenance',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: authorId,
    deadlineAt: '2026-12-31T00:00:00.000Z',
    deadlineDays: 30,
    description: 'Please fix it.',
    hoaEmailSentAt: null,
    hoaResponse: null,
    hoaResponseAt: null,
    id: 'fixture-petition-search',
    requiredSignatures: 3,
    signatureCount: 0,
    status: 'open',
    succeededAt: null,
    title: `${NEEDLE} repairs`,
  };

  setState((current) => ({
    ...current,
    events: [...current.events, event],
    missions: [...current.missions, mission],
    petitions: [...current.petitions, petition],
    posts: [...current.posts, post],
    serviceListings: [...current.serviceListings, service],
  }));
}

describe('searchAll (memory)', () => {
  test('returns no results below the minimum query length guard from the route', async () => {
    seedMatchingContent();
    const response = await getSearchRoute(new Request('http://test/api/search?q=z'));
    const body = (await response.json()) as {
      readonly posts: readonly unknown[];
      readonly events: readonly unknown[];
      readonly missions: readonly unknown[];
      readonly services: readonly unknown[];
      readonly petitions: readonly unknown[];
    };
    expect(body).toEqual({ events: [], missions: [], petitions: [], posts: [], services: [] });
  });

  test('finds a matching item in every content type by its title field', async () => {
    seedMatchingContent();
    const results = await searchAll(ctx(), NEEDLE);

    expect(results.posts.map((item) => item.id)).toEqual(['fixture-post-search']);
    expect(results.events.map((item) => item.id)).toEqual(['fixture-event-search']);
    expect(results.missions.map((item) => item.id)).toEqual(['fixture-mission-search']);
    expect(results.petitions.map((item) => item.id)).toEqual(['fixture-petition-search']);
    // Services search by business_name, not a "title" field -- this is the
    // one entity whose title-equivalent column is named differently.
    expect(results.services.map((item) => item.id)).toEqual(['fixture-service-search']);
  });

  test('is case-insensitive', async () => {
    seedMatchingContent();
    const results = await searchAll(ctx(), NEEDLE.toUpperCase());
    expect(results.posts).toHaveLength(1);
  });

  test('excludes content from a muted author, same as every other list endpoint', async () => {
    seedMatchingContent('user-mia');
    await toggleMute(ctx(DEMO_USER_ID), 'user-mia');

    const results = await searchAll(ctx(DEMO_USER_ID), NEEDLE);

    expect(results.posts).toHaveLength(0);
    expect(results.events).toHaveLength(0);
    expect(results.missions).toHaveLength(0);
    expect(results.services).toHaveLength(0);
    expect(results.petitions).toHaveLength(0);
  });

  test('the GET /api/search route returns the same shape', async () => {
    seedMatchingContent();
    const response = await getSearchRoute(
      new Request(`http://test/api/search?q=${encodeURIComponent(NEEDLE)}`),
    );
    const body = (await response.json()) as { readonly posts: readonly { readonly id: string }[] };
    expect(body.posts.map((item) => item.id)).toEqual(['fixture-post-search']);
  });
});

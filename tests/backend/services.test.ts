import { afterEach, describe, expect, test } from 'bun:test';

import {
  GET as getServices,
  POST as postService,
} from '../../app/api/services+api';
import {
  DELETE as deleteServiceRoute,
  GET as getServiceRoute,
  PATCH as patchServiceRoute,
} from '../../app/api/services/[id]/index+api';
import {
  GET as getServiceReviews,
  POST as postServiceReview,
} from '../../app/api/services/[id]/reviews+api';
import { GET as getMyServiceListingsRoute } from '../../app/api/services/mine+api';
import {
  DELETE as deleteReviewRoute,
  PATCH as patchReviewRoute,
} from '../../app/api/service-reviews/[id]/index+api';
import { POST as reportReviewRoute } from '../../app/api/service-reviews/[id]/report+api';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { toggleMute } from '../../src/backend/mutes';
import {
  createServiceReview,
  deleteServiceReview,
  listServiceReviews,
  listServiceReviewsPage,
  reportServiceReview,
  updateServiceReview,
} from '../../src/backend/service-reviews';
import {
  createServiceListing,
  deleteServiceListing,
  getMyServiceListingsView,
  getServicesView,
  listServicesPage,
  updateServiceListing,
} from '../../src/backend/services';
import type { ValidReportSubmission } from '@/src/backend/reports';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';
import { CREATE_CONTENT_XP } from '../../src/backend/xp';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);
const TEST_REPORT_SUBMISSION: ValidReportSubmission = {
  details: null,
  evidenceImageDataUrl: null,
  reason: 'other',
};

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

const validListingInput = {
  businessName: 'Test Yard Care',
  category: 'home-services',
  description: 'Mowing, edging, and cleanup.',
  contactPhone: '(702) 555-0100',
  contactEmail: '',
  contactWebsite: '',
  serviceArea: 'Lake Las Vegas',
} as const;

describe('getServicesView', () => {
  test('lists the seeded listings with authors and rating summaries', async () => {
    const { listings } = await getServicesView(ctx());

    expect(listings.map((listing) => listing.id)).toEqual([
      'service-4',
      'service-3',
      'service-2',
      'service-1',
    ]);
    const dogWalker = listings.find((listing) => listing.id === 'service-1');
    expect(dogWalker).toMatchObject({
      author: { id: 'user-riley', name: 'Riley Kim' },
      averageRating: 5,
      reviewCount: 1,
    });
    const poolCare = listings.find((listing) => listing.id === 'service-3');
    expect(poolCare).toMatchObject({ averageRating: null, reviewCount: 0 });
  });

  test('filters by category', async () => {
    const { listings } = await getServicesView(ctx(), { category: 'pool-spa' });

    expect(listings.map((listing) => listing.id)).toEqual(['service-3']);
  });

  test('a newly created listing sorts first, matching the Supabase ordering', async () => {
    const created = await createServiceListing(ctx(), validListingInput);
    if (!created.ok) throw new Error('setup failed');

    const { listings } = await getServicesView(ctx());
    expect(listings[0]?.id).toBe(created.listing.id);
  });
});

describe('listServicesPage', () => {
  test('paginates the full directory, newest first', async () => {
    const first = await listServicesPage(ctx(), { limit: 2 });
    expect(first.listings.map((listing) => listing.id)).toEqual([
      'service-4',
      'service-3',
    ]);
    expect(first.nextCursor).not.toBeNull();

    const second = await listServicesPage(ctx(), {
      cursor: first.nextCursor,
      limit: 2,
    });
    expect(second.listings.map((listing) => listing.id)).toEqual([
      'service-2',
      'service-1',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  test('paginates within a category filter', async () => {
    const page = await listServicesPage(ctx(), { category: 'pool-spa', limit: 20 });
    expect(page.listings.map((listing) => listing.id)).toEqual(['service-3']);
    expect(page.nextCursor).toBeNull();
  });

  test('GET /api/services respects limit and category together', async () => {
    const response = await getServices(
      new Request('http://localhost/api/services?limit=1&category=pool-spa'),
    );
    const body = (await response.json()) as {
      listings: readonly { id: string }[];
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.listings).toEqual([expect.objectContaining({ id: 'service-3' })]);
    expect(body.nextCursor).toBeNull();
  });

  test('excludes listings created by a muted author', async () => {
    // service-3 is authored by user-sam.
    const before = await listServicesPage(ctx(), { limit: 20 });
    expect(before.listings.map((listing) => listing.id)).toContain('service-3');

    await toggleMute(ctx(), 'user-sam');

    const after = await listServicesPage(ctx(), { limit: 20 });
    expect(after.listings.map((listing) => listing.id)).not.toContain('service-3');
  });
});

describe('GET /api/services/:id', () => {
  test('returns the listing when it exists', async () => {
    const response = await getServiceRoute(
      new Request('http://localhost/api/services/service-1'),
      { id: 'service-1' },
    );
    const body = (await response.json()) as { listing: { id: string } };

    expect(response.status).toBe(200);
    expect(body.listing.id).toBe('service-1');
  });

  test('returns 404 for an unknown listing id', async () => {
    const response = await getServiceRoute(
      new Request('http://localhost/api/services/does-not-exist'),
      { id: 'does-not-exist' },
    );

    expect(response.status).toBe(404);
  });
});

describe('createServiceListing', () => {
  test('creates a listing attributed to the acting user', async () => {
    const result = await createServiceListing(ctx(), validListingInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.listing).toMatchObject({
      author: { id: DEMO_USER_ID },
      businessName: 'Test Yard Care',
      category: 'home-services',
      contactPhone: '(702) 555-0100',
      averageRating: null,
      reviewCount: 0,
    });

    const listed = (await getServicesView(ctx())).listings.find(
      (listing) => listing.id === result.listing.id,
    );
    expect(listed).toBeDefined();
  });

  test('rejects a missing business name or description', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      businessName: '',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });

  test('rejects an unknown category', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      category: 'not-a-category',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });

  test('accepts the dining category', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      category: 'dining',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.category).toBe('dining');
    }
  });

  test('rejects a listing with no contact method at all', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });

  test('rejects an oversized business name', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      businessName: 'x'.repeat(81),
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });

  test('rejects an oversized description', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      description: 'x'.repeat(1001),
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });

  test('rejects an oversized contact field', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      contactPhone: 'x'.repeat(121),
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });

  test('rejects an oversized serviceArea', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      serviceArea: 'x'.repeat(121),
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });

  test('stores uploaded images as listing media', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'yard.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.media).toEqual([
        { filename: 'yard.jpg', url: 'data:image/jpeg;base64,b25l' },
      ]);
    }
  });

  test('stores an uploaded logo separately from listing media', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      newLogo: { dataUrl: 'data:image/png;base64,bG9nbw==', filename: 'logo.png' },
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'yard.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.logo).toEqual({
        filename: 'logo.png',
        url: 'data:image/png;base64,bG9nbw==',
      });
      expect(result.listing.media).toEqual([
        { filename: 'yard.jpg', url: 'data:image/jpeg;base64,b25l' },
      ]);
    }
  });

  test('normalizes a bare domain contactWebsite to a full https URL', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      contactWebsite: 'nolancode.com',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.contactWebsite).toBe('https://nolancode.com');
    }
  });

  test('leaves an already-schemed contactWebsite untouched', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      contactWebsite: 'https://www.nolancode.com',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.contactWebsite).toBe('https://www.nolancode.com');
    }
  });

  test('hours is optional — an empty value is stored as null', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      hours: '',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.hours).toBeNull();
    }
  });

  test('stores a provided hours string', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      hours: 'Mon–Fri 8am–6pm',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.hours).toBe('Mon–Fri 8am–6pm');
    }
  });

  test('rejects an oversized hours field', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      hours: 'x'.repeat(121),
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_service_listing' });
  });
});

describe('updateServiceListing', () => {
  test('the owner can edit their own listing', async () => {
    const created = await createServiceListing(ctx(), validListingInput);
    if (!created.ok) throw new Error('setup failed');

    const result = await updateServiceListing(ctx(), created.listing.id, {
      ...validListingInput,
      businessName: 'Updated Yard Care',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.businessName).toBe('Updated Yard Care');
    }
  });

  test('stamps editedAt on update, unset until then', async () => {
    const created = await createServiceListing(ctx(), validListingInput);
    if (!created.ok) throw new Error('setup failed');
    expect(created.listing.editedAt).toBeNull();

    const result = await updateServiceListing(ctx(), created.listing.id, validListingInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.editedAt).not.toBeNull();
    }
  });

  test('rejects edits from a user who does not own the listing', async () => {
    const result = await updateServiceListing(ctx('user-mia'), 'service-1', validListingInput);

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('returns not_found for an unknown listing', async () => {
    const result = await updateServiceListing(ctx(), 'service-999', validListingInput);

    expect(result).toMatchObject({ ok: false, code: 'service_listing_not_found' });
  });

  test('can add a logo on edit, and keeps it if re-submitted as existingLogo', async () => {
    const created = await createServiceListing(ctx(), validListingInput);
    if (!created.ok) throw new Error('setup failed');

    const withLogo = await updateServiceListing(ctx(), created.listing.id, {
      ...validListingInput,
      newLogo: { dataUrl: 'data:image/png;base64,bG9nbw==', filename: 'logo.png' },
    });
    expect(withLogo.ok).toBe(true);
    if (!withLogo.ok) return;
    expect(withLogo.listing.logo).toEqual({
      filename: 'logo.png',
      url: 'data:image/png;base64,bG9nbw==',
    });

    const kept = await updateServiceListing(ctx(), created.listing.id, {
      ...validListingInput,
      businessName: 'Updated Yard Care',
      existingLogo: withLogo.listing.logo,
    });
    expect(kept.ok).toBe(true);
    if (kept.ok) {
      expect(kept.listing.logo).toEqual(withLogo.listing.logo);
    }
  });

  test('normalizes a bare domain contactWebsite on edit too', async () => {
    const created = await createServiceListing(ctx(), validListingInput);
    if (!created.ok) throw new Error('setup failed');

    const result = await updateServiceListing(ctx(), created.listing.id, {
      ...validListingInput,
      contactWebsite: 'nolancode.com',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.contactWebsite).toBe('https://nolancode.com');
    }
  });

  test('hours can be set, changed, and cleared across edits', async () => {
    const created = await createServiceListing(ctx(), {
      ...validListingInput,
      hours: 'Mon–Fri 8am–6pm',
    });
    if (!created.ok) throw new Error('setup failed');
    expect(created.listing.hours).toBe('Mon–Fri 8am–6pm');

    const changed = await updateServiceListing(ctx(), created.listing.id, {
      ...validListingInput,
      hours: 'Mon–Sun 7am–9pm',
    });
    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.listing.hours).toBe('Mon–Sun 7am–9pm');
    }

    const cleared = await updateServiceListing(ctx(), created.listing.id, {
      ...validListingInput,
      hours: '',
    });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.listing.hours).toBeNull();
    }
  });
});

describe('getMyServiceListingsView', () => {
  test("returns only the caller's own listings, not the whole directory", async () => {
    const demoPage = await getMyServiceListingsView(ctx());
    expect(demoPage).toEqual({ listings: [], nextCursor: null });

    const rileyPage = await getMyServiceListingsView(ctx('user-riley'));
    expect(rileyPage.listings.map((listing) => listing.id)).toEqual([
      'service-1',
    ]);
  });

  test('paginates with a cursor rather than returning the whole directory', async () => {
    await createServiceListing(ctx('user-riley'), {
      ...validListingInput,
      businessName: 'Second Listing',
    });

    const firstPage = await getMyServiceListingsView(ctx('user-riley'), {
      limit: 1,
    });
    expect(firstPage.listings).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await getMyServiceListingsView(ctx('user-riley'), {
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.listings).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('route returns a bounded page shape', async () => {
    const response = await getMyServiceListingsRoute(
      new Request('http://localhost/api/services/mine'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      listings: readonly unknown[];
      nextCursor: string | null;
    };
    expect(Array.isArray(body.listings)).toBe(true);
  });
});

describe('deleteServiceListing', () => {
  test('the owner can delete their own listing, cascading its reviews', async () => {
    const created = await createServiceListing(ctx(), validListingInput);
    if (!created.ok) throw new Error('setup failed');
    const review = await createServiceReview(ctx('user-mia'), created.listing.id, {
      body: 'Great job!',
      rating: 5,
    });
    if (!review.ok) throw new Error('setup failed');

    expect(await deleteServiceListing(ctx(), created.listing.id)).toBe(true);
    expect(
      (await getServicesView(ctx())).listings.some(
        (listing) => listing.id === created.listing.id,
      ),
    ).toBe(false);
    expect(await listServiceReviews(ctx(), created.listing.id)).toEqual([]);
  });

  test('returns false for a user who does not own the listing', async () => {
    expect(await deleteServiceListing(ctx('user-mia'), 'service-1')).toBe(false);
  });
});

describe('listServiceReviews', () => {
  test('returns the seeded review for service-1, newest first', async () => {
    await createServiceReview(ctx('user-andre'), 'service-1', {
      body: 'Second opinion',
      rating: 4,
    });

    const reviews = await listServiceReviews(ctx(), 'service-1');
    expect(reviews.map((review) => review.body)).toEqual([
      'Second opinion',
      'Riley has been walking our lab for months — always on time and sends photos!',
    ]);
  });

  test('hides reviews from an author the viewer has muted', async () => {
    await createServiceReview(ctx('user-andre'), 'service-1', {
      body: 'Second opinion',
      rating: 4,
    });

    await toggleMute(ctx(), 'user-andre');

    const reviews = await listServiceReviews(ctx(), 'service-1');
    expect(reviews.some((review) => review.author.id === 'user-andre')).toBe(
      false,
    );
  });
});

describe('listServiceReviewsPage', () => {
  test('paginates newest-first and preserves that order across pages', async () => {
    await createServiceReview(ctx('user-andre'), 'service-1', {
      body: 'Second opinion',
      rating: 4,
    });

    const first = await listServiceReviewsPage(ctx(), 'service-1', { limit: 1 });
    expect(first.reviews.map((review) => review.body)).toEqual([
      'Second opinion',
    ]);
    expect(first.nextCursor).not.toBeNull();

    const second = await listServiceReviewsPage(ctx(), 'service-1', {
      cursor: first.nextCursor,
      limit: 1,
    });
    expect(second.reviews.map((review) => review.body)).toEqual([
      'Riley has been walking our lab for months — always on time and sends photos!',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  test('hides reviews from an author the viewer has muted', async () => {
    await createServiceReview(ctx('user-andre'), 'service-1', {
      body: 'Second opinion',
      rating: 4,
    });

    await toggleMute(ctx(), 'user-andre');

    const page = await listServiceReviewsPage(ctx(), 'service-1');
    expect(
      page.reviews.some((review) => review.author.id === 'user-andre'),
    ).toBe(false);
  });

  test('returns an empty page for a listing with no reviews', async () => {
    const page = await listServiceReviewsPage(ctx(), 'service-4');
    expect(page.reviews).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

describe('createServiceReview', () => {
  test('allows a rating with no body — text is optional, unlike a comment', async () => {
    const result = await createServiceReview(ctx(), 'service-1', {
      body: '  ',
      rating: 5,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.body).toBeNull();
      expect(result.review.rating).toBe(5);
    }
  });

  test('rejects an oversized body', async () => {
    expect(
      await createServiceReview(ctx(), 'service-1', {
        body: 'x'.repeat(1001),
        rating: 5,
      }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a rating outside 1-5', async () => {
    expect(
      await createServiceReview(ctx(), 'service-1', { body: 'nice', rating: 6 }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a review with no rating at all — text alone is not a complete review', async () => {
    expect(
      await createServiceReview(ctx(), 'service-1', { body: 'nice' }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a review on an unknown listing', async () => {
    expect(
      await createServiceReview(ctx(), 'service-nope', { body: 'nice', rating: 5 }),
    ).toMatchObject({ ok: false, code: 'service_listing_not_found' });
  });

  test('creates a review attributed to the acting user', async () => {
    const result = await createServiceReview(ctx(), 'service-4', {
      body: ' Fast and friendly! ',
      rating: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.review).toMatchObject({
      listingId: 'service-4',
      author: { id: DEMO_USER_ID, name: 'You' },
      body: 'Fast and friendly!',
      rating: 5,
    });
  });

  test('rejects reviewing your own listing', async () => {
    const created = await createServiceListing(ctx(), validListingInput);
    if (!created.ok) throw new Error('setup failed');

    const result = await createServiceReview(ctx(), created.listing.id, {
      body: 'nice',
      rating: 5,
    });

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('rejects a second review from the same author on the same listing', async () => {
    // service-2 already has a seeded review authored by DEMO_USER_ID.
    const result = await createServiceReview(ctx(), 'service-2', {
      body: 'trying again',
      rating: 1,
    });

    expect(result).toMatchObject({ ok: false, code: 'already_reviewed' });
  });
});

describe('updateServiceReview', () => {
  test('the author can edit their own review', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateServiceReview(ctx(), created.review.id, {
      body: 'updated',
      rating: 5,
    });

    expect(result).toMatchObject({
      ok: true,
      review: { body: 'updated', rating: 5 },
    });
  });

  test('stamps editedAt on update, unset until then', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');
    expect(created.review.editedAt).toBeNull();

    const result = await updateServiceReview(ctx(), created.review.id, {
      body: 'updated',
      rating: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.editedAt).not.toBeNull();
    }
  });

  test('rejects edits from a user who does not own the review', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateServiceReview(ctx('user-mia'), created.review.id, {
      body: 'hijacked',
      rating: 1,
    });

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('rejects an invalid rating', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateServiceReview(ctx(), created.review.id, {
      body: 'still mine',
      rating: 9,
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('returns not_found for an unknown review', async () => {
    const result = await updateServiceReview(ctx(), 'svc-review-nope', {
      body: 'x',
      rating: 3,
    });

    expect(result).toMatchObject({ ok: false, code: 'service_review_not_found' });
  });

  test('can clear the body down to a rating-only review', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateServiceReview(ctx(), created.review.id, {
      body: '   ',
      rating: 4,
    });

    expect(result).toMatchObject({ ok: true, review: { body: null, rating: 4 } });
  });
});

describe('deleteServiceReview', () => {
  test('deletes only the author’s own review', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    expect(await deleteServiceReview(ctx('user-mia'), created.review.id)).toBe(false);
    expect(await deleteServiceReview(ctx(), created.review.id)).toBe(true);
    expect(await listServiceReviews(ctx(), 'service-3')).toEqual([]);
  });

  test('returns false for an unknown review', async () => {
    expect(await deleteServiceReview(ctx(), 'svc-review-nope')).toBe(false);
  });
});

describe('reportServiceReview', () => {
  test('reports an existing review', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await reportServiceReview(
      ctx('user-mia'),
      created.review.id,
      TEST_REPORT_SUBMISSION,
    );

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().serviceReviewReports.some(
        (report) =>
          report.serviceReviewId === created.review.id &&
          report.reporterId === 'user-mia',
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same review twice records one report', async () => {
    const created = await createServiceReview(ctx(), 'service-3', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    await reportServiceReview(ctx('user-mia'), created.review.id, TEST_REPORT_SUBMISSION);
    await reportServiceReview(ctx('user-mia'), created.review.id, TEST_REPORT_SUBMISSION);

    expect(
      getState().serviceReviewReports.filter(
        (report) =>
          report.serviceReviewId === created.review.id &&
          report.reporterId === 'user-mia',
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown review', async () => {
    const result = await reportServiceReview(ctx(), 'svc-review-nope', TEST_REPORT_SUBMISSION);

    expect(result).toMatchObject({ ok: false, code: 'service_review_not_found' });
  });
});

describe('service routes', () => {
  test('GET/POST /api/services and PATCH/DELETE /api/services/:id', async () => {
    const created = await postService(
      new Request('http://localhost/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validListingInput),
      }),
    );
    expect(created.status).toBe(201);
    const { listing, xpAward } = (await created.json()) as {
      listing: { id: string };
      xpAward: { awardedXp: number };
    };
    // Regression: the route handler used to hand-pick only `listing` off
    // the backend result, silently dropping xpAward -- the client's
    // useNotifyXpAwarded then crashed on the missing field, breaking the
    // composer's own onSuccess before it could run.
    expect(xpAward.awardedXp).toBe(CREATE_CONTENT_XP);

    const listed = await getServices(new Request('http://localhost/api/services'));
    const { listings } = (await listed.json()) as {
      listings: readonly { id: string }[];
    };
    expect(listings.some((entry) => entry.id === listing.id)).toBe(true);

    const patched = await patchServiceRoute(
      new Request(`http://localhost/api/services/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validListingInput, businessName: 'Renamed' }),
      }),
      { id: listing.id },
    );
    expect(patched.status).toBe(200);

    const removed = await deleteServiceRoute(
      new Request(`http://localhost/api/services/${listing.id}`, {
        method: 'DELETE',
      }),
      { id: listing.id },
    );
    expect(removed.status).toBe(200);
  });

  test('PATCH returns 403 for a listing owned by someone else', async () => {
    const response = await patchServiceRoute(
      new Request('http://localhost/api/services/service-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validListingInput),
      }),
      { id: 'service-1' },
    );

    expect(response.status).toBe(403);
  });

  test('GET returns { reviews }; POST creates 201; DELETE removes; report is 200', async () => {
    const created = await postServiceReview(
      new Request('http://localhost/api/services/service-4/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Looking sharp', rating: 5 }),
      }),
      { id: 'service-4' },
    );
    expect(created.status).toBe(201);
    const { review } = (await created.json()) as { review: { id: string } };

    const listed = await getServiceReviews(
      new Request('http://localhost/api/services/service-4/reviews'),
      { id: 'service-4' },
    );
    const { reviews } = (await listed.json()) as {
      reviews: readonly { id: string }[];
    };
    expect(reviews[0]?.id).toBe(review.id);

    const reported = await reportReviewRoute(
      new Request(`http://localhost/api/service-reviews/${review.id}/report`, {
        body: JSON.stringify({ reason: 'other' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      { id: review.id },
    );
    expect(reported.status).toBe(200);

    const patched = await patchReviewRoute(
      new Request(`http://localhost/api/service-reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Even sharper', rating: 4 }),
      }),
      { id: review.id },
    );
    expect(patched.status).toBe(200);
    const { review: patchedReview } = (await patched.json()) as {
      review: { body: string; rating: number };
    };
    expect(patchedReview).toMatchObject({ body: 'Even sharper', rating: 4 });

    const removed = await deleteReviewRoute(
      new Request(`http://localhost/api/service-reviews/${review.id}`, {
        method: 'DELETE',
      }),
      { id: review.id },
    );
    expect(removed.status).toBe(200);
  });

  test('GET honors ?limit and ?cursor for pagination', async () => {
    await postServiceReview(
      new Request('http://localhost/api/services/service-1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Second opinion', rating: 4 }),
      }),
      { id: 'service-1' },
    );

    const firstResponse = await getServiceReviews(
      new Request('http://localhost/api/services/service-1/reviews?limit=1'),
      { id: 'service-1' },
    );
    const first = (await firstResponse.json()) as {
      reviews: readonly { body: string | null }[];
      nextCursor: string | null;
    };
    expect(first.reviews.map((review) => review.body)).toEqual([
      'Second opinion',
    ]);
    expect(first.nextCursor).not.toBeNull();

    const secondResponse = await getServiceReviews(
      new Request(
        `http://localhost/api/services/service-1/reviews?limit=1&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
      ),
      { id: 'service-1' },
    );
    const second = (await secondResponse.json()) as {
      reviews: readonly { body: string | null }[];
      nextCursor: string | null;
    };
    expect(second.reviews.map((review) => review.body)).toEqual([
      'Riley has been walking our lab for months — always on time and sends photos!',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  test('POST review returns 404 for an unknown listing', async () => {
    const response = await postServiceReview(
      new Request('http://localhost/api/services/service-nope/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'hi', rating: 5 }),
      }),
      { id: 'service-nope' },
    );
    expect(response.status).toBe(404);
  });

  test('POST review returns 403 when the acting user owns the listing', async () => {
    const ownListing = await postService(
      new Request('http://localhost/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validListingInput),
      }),
    );
    const { listing } = (await ownListing.json()) as { listing: { id: string } };

    const response = await postServiceReview(
      new Request(`http://localhost/api/services/${listing.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'hi', rating: 5 }),
      }),
      { id: listing.id },
    );
    expect(response.status).toBe(403);
  });

  test('POST review returns 400 for a listing the acting user already reviewed', async () => {
    // service-2 already has a seeded review authored by DEMO_USER_ID (the
    // route's fixed acting user in this test suite).
    const response = await postServiceReview(
      new Request('http://localhost/api/services/service-2/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'trying again', rating: 1 }),
      }),
      { id: 'service-2' },
    );
    expect(response.status).toBe(400);
  });

  test('PATCH review returns 403 for a review owned by someone else', async () => {
    // service-review-1 is seeded as authored by user-mia; the route always
    // acts as DEMO_USER_ID, so this exercises the ownership check exactly
    // like the "PATCH returns 403 for a listing owned by someone else" test
    // above does for listings.
    const response = await patchReviewRoute(
      new Request('http://localhost/api/service-reviews/service-review-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'hijacked', rating: 1 }),
      }),
      { id: 'service-review-1' },
    );
    expect(response.status).toBe(403);
  });
});

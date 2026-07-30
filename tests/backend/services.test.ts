import { afterEach, describe, expect, test } from 'bun:test';

import {
  GET as getServices,
  POST as postService,
} from '../../app/api/services+api';
import {
  DELETE as deleteServiceRoute,
  PATCH as patchServiceRoute,
} from '../../app/api/services/[id]/index+api';
import {
  GET as getServiceReviews,
  POST as postServiceReview,
} from '../../app/api/services/[id]/reviews+api';
import {
  DELETE as deleteReviewRoute,
  PATCH as patchReviewRoute,
} from '../../app/api/service-reviews/[id]/index+api';
import { POST as reportReviewRoute } from '../../app/api/service-reviews/[id]/report+api';
import { memoryContext } from '../../src/backend/http';
import { toggleMute } from '../../src/backend/mutes';
import {
  createServiceReview,
  deleteServiceReview,
  listServiceReviews,
  reportServiceReview,
  updateServiceReview,
} from '../../src/backend/service-reviews';
import {
  createServiceListing,
  deleteServiceListing,
  getServicesView,
  updateServiceListing,
} from '../../src/backend/services';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
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
      'service-1',
      'service-2',
      'service-3',
      'service-4',
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

  test('rejects a listing with no contact method at all', async () => {
    const result = await createServiceListing(ctx(), {
      ...validListingInput,
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
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

  test('rejects edits from a user who does not own the listing', async () => {
    const result = await updateServiceListing(ctx('user-mia'), 'service-1', validListingInput);

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('returns not_found for an unknown listing', async () => {
    const result = await updateServiceListing(ctx(), 'service-999', validListingInput);

    expect(result).toMatchObject({ ok: false, code: 'service_listing_not_found' });
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

describe('createServiceReview', () => {
  test('rejects an empty body', async () => {
    expect(
      await createServiceReview(ctx(), 'service-1', { body: '  ', rating: 5 }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a rating outside 1-5', async () => {
    expect(
      await createServiceReview(ctx(), 'service-1', { body: 'nice', rating: 6 }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a review on an unknown listing', async () => {
    expect(
      await createServiceReview(ctx(), 'service-nope', { body: 'nice', rating: 5 }),
    ).toMatchObject({ ok: false, code: 'service_listing_not_found' });
  });

  test('creates a review attributed to the acting user', async () => {
    const result = await createServiceReview(ctx(), 'service-2', {
      body: ' Fast and friendly! ',
      rating: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.review).toMatchObject({
      listingId: 'service-2',
      author: { id: DEMO_USER_ID, name: 'You' },
      body: 'Fast and friendly!',
      rating: 5,
    });
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

    expect(result).toMatchObject({ ok: false, code: 'service_review_not_found' });
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

    const result = await reportServiceReview(ctx('user-mia'), created.review.id);

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

    await reportServiceReview(ctx('user-mia'), created.review.id);
    await reportServiceReview(ctx('user-mia'), created.review.id);

    expect(
      getState().serviceReviewReports.filter(
        (report) =>
          report.serviceReviewId === created.review.id &&
          report.reporterId === 'user-mia',
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown review', async () => {
    const result = await reportServiceReview(ctx(), 'svc-review-nope');

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
    const { listing } = (await created.json()) as { listing: { id: string } };

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
      new Request('http://localhost/api/services/service-2/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Looking sharp', rating: 5 }),
      }),
      { id: 'service-2' },
    );
    expect(created.status).toBe(201);
    const { review } = (await created.json()) as { review: { id: string } };

    const listed = await getServiceReviews(
      new Request('http://localhost/api/services/service-2/reviews'),
      { id: 'service-2' },
    );
    const { reviews } = (await listed.json()) as {
      reviews: readonly { id: string }[];
    };
    expect(reviews[0]?.id).toBe(review.id);

    const reported = await reportReviewRoute(
      new Request(`http://localhost/api/service-reviews/${review.id}/report`, {
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
});

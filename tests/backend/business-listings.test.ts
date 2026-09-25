import { afterEach, describe, expect, test } from 'bun:test';

import {
  GET as getBusinessListings,
  POST as postBusinessListing,
} from '../../app/api/business-listings+api';
import {
  DELETE as deleteBusinessListingRoute,
  GET as getBusinessListingRoute,
  PATCH as patchBusinessListingRoute,
} from '../../app/api/business-listings/[id]/index+api';
import { POST as reportBusinessListingRoute } from '../../app/api/business-listings/[id]/report+api';
import {
  GET as getBusinessListingReviews,
  POST as postBusinessListingReview,
} from '../../app/api/business-listings/[id]/reviews+api';
import { GET as getMyBusinessListingsRoute } from '../../app/api/business-listings/mine+api';
import {
  DELETE as deleteBusinessListingReviewRoute,
  PATCH as patchBusinessListingReviewRoute,
} from '../../app/api/business-listing-reviews/[id]/index+api';
import { POST as reportBusinessListingReviewRoute } from '../../app/api/business-listing-reviews/[id]/report+api';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { toggleMute } from '../../src/backend/mutes';
import {
  createBusinessListing,
  deleteBusinessListing,
  getBusinessesByIds,
  getBusinessesView,
  getMyBusinessListingsView,
  listBusinessesPage,
  reportBusinessListing,
  updateBusinessListing,
} from '../../src/backend/business-listings';
import {
  createBusinessListingReview,
  deleteBusinessListingReview,
  listBusinessListingReviews,
  listBusinessListingReviewsPage,
  reportBusinessListingReview,
  updateBusinessListingReview,
} from '../../src/backend/business-listing-reviews';
import { fetchWebsiteSummary } from '../../src/backend/business-listings/website-fetch';
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

const domainMatchedInput = {
  businessName: 'Test Coffee Co',
  category: 'restaurants-bars',
  description: 'Small-batch coffee and pastries on the promenade.',
  contactPhone: '',
  contactEmail: 'hello@testcoffeeco.example',
  contactWebsite: 'https://testcoffeeco.example',
  address: '1 Promenade Drive',
  hours: '',
} as const;

// No matching domain and no ANTHROPIC_API_KEY in the test environment, so
// the assisted tier's classifyBusinessListing() call fails closed to null
// -- this is the "missing API key" fail-closed path, exercised for real
// rather than mocked.
const unresolvedInput = {
  businessName: 'Test Golf Carts',
  category: 'professional-trade',
  description: 'Golf cart sales and repair for residents.',
  contactPhone: '(702) 555-0111',
  contactEmail: '',
  contactWebsite: '',
  address: '2 Promenade Drive',
  hours: '',
} as const;

describe('createBusinessListing verification pipeline', () => {
  // The core regression test for the anti-impersonation fix: a matching
  // domain used to verify a listing on its own, with no check that the
  // domain was real, reachable, or an actual Lake Las Vegas business --
  // anyone could fabricate a matching website + email pair. Domain match is
  // now only ever an input signal to the classifier (see verification.ts),
  // so without a working classifier (no ANTHROPIC_API_KEY in this test
  // environment) it must fail closed exactly like every other case.
  test('a matching contact-email domain alone does not verify without a working classifier', async () => {
    const result = await createBusinessListing(ctx(), domainMatchedInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.listing).toMatchObject({
      verificationStatus: 'pending',
      verificationMethod: null,
    });
    expect(result.listing.verifiedAt).toBeNull();
  });

  test('no website and no configured Anthropic key fails closed to pending', async () => {
    const result = await createBusinessListing(ctx(), unresolvedInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.listing).toMatchObject({
      verificationStatus: 'pending',
      verificationMethod: null,
    });
    expect(result.listing.verifiedAt).toBeNull();
  });

  test('a mismatched contact-email domain also fails closed to pending', async () => {
    const result = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      contactEmail: 'someone@unrelated.example',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.listing.verificationStatus).toBe('pending');
  });

  test('grants XP for a successful listing, mirroring service listings', async () => {
    const result = await createBusinessListing(ctx(), domainMatchedInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xpAward.awardedXp).toBe(CREATE_CONTENT_XP);
  });

  test('rejects a missing business name or description', async () => {
    const result = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      businessName: '',
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_business_listing' });
  });

  test('rejects an unknown category', async () => {
    const result = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      category: 'not-a-category',
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_business_listing' });
  });

  test('rejects a listing with no contact method at all', async () => {
    const result = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_business_listing' });
  });

  test('normalizes a bare domain contactWebsite to a full https URL', async () => {
    const result = await createBusinessListing(ctx(), {
      ...unresolvedInput,
      contactWebsite: 'testgolfcarts.example',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.contactWebsite).toBe('https://testgolfcarts.example');
    }
  });

  test('stores and clears current specials, stamping specialsUpdatedAt', async () => {
    const created = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      currentSpecials: ['Half-off pastries before 9am.'],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.listing.currentSpecials).toEqual(['Half-off pastries before 9am.']);
    expect(created.listing.specialsUpdatedAt).not.toBeNull();
  });

  test('an empty specials list is valid — the field stays fully optional', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.listing.currentSpecials).toEqual([]);
    expect(created.listing.specialsUpdatedAt).toBeNull();
  });

  test('multiple specials round-trip through create', async () => {
    const created = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      currentSpecials: ['Half-off pastries before 9am.', 'Free coffee refills all day.'],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.listing.currentSpecials).toEqual([
      'Half-off pastries before 9am.',
      'Free coffee refills all day.',
    ]);
  });

  test('rejects more than 5 specials', async () => {
    const result = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      currentSpecials: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_business_listing' });
  });

  test('rejects a special over 200 characters, even when it is not the first entry', async () => {
    const result = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      currentSpecials: ['Short one.', 'x'.repeat(201)],
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_business_listing' });
  });

  test('drops empty/whitespace-only entries and trims the rest', async () => {
    const created = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      currentSpecials: ['  Half-off pastries before 9am.  ', '   ', ''],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.listing.currentSpecials).toEqual(['Half-off pastries before 9am.']);
  });
});

describe('fetchWebsiteSummary (SSRF guard)', () => {
  test('a nonexistent domain is treated as unreachable, not thrown', async () => {
    // The .example TLD is reserved by IANA to never resolve (RFC 2606) --
    // deterministic without mocking DNS.
    const result = await fetchWebsiteSummary('https://totally-fake-business.example');
    expect(result).toEqual({ reachable: false, summary: null });
  });

  test('rejects a non-http(s) scheme outright', async () => {
    const result = await fetchWebsiteSummary('file:///etc/passwd');
    expect(result).toEqual({ reachable: false, summary: null });
  });

  test('rejects an unparseable URL outright', async () => {
    const result = await fetchWebsiteSummary('not a url');
    expect(result).toEqual({ reachable: false, summary: null });
  });

  test('blocks a loopback address', async () => {
    const result = await fetchWebsiteSummary('http://127.0.0.1/');
    expect(result).toEqual({ reachable: false, summary: null });
  });

  test('blocks the cloud-metadata link-local address', async () => {
    const result = await fetchWebsiteSummary('http://169.254.169.254/latest/meta-data/');
    expect(result).toEqual({ reachable: false, summary: null });
  });

  test('blocks a private RFC1918 address', async () => {
    const result = await fetchWebsiteSummary('http://10.0.0.5/');
    expect(result).toEqual({ reachable: false, summary: null });
  });

  test('blocks "localhost" by name', async () => {
    const result = await fetchWebsiteSummary('http://localhost:5432/');
    expect(result).toEqual({ reachable: false, summary: null });
  });
});

describe('memory-mode verified-or-own visibility filter', () => {
  test('getBusinessesView hides a pending listing from everyone but its owner', async () => {
    const created = await createBusinessListing(ctx('user-riley'), unresolvedInput);
    if (!created.ok) throw new Error('setup failed');

    const strangerView = await getBusinessesView(ctx('user-mia'));
    expect(strangerView.listings.some((listing) => listing.id === created.listing.id)).toBe(
      false,
    );

    const ownerView = await getBusinessesView(ctx('user-riley'));
    expect(ownerView.listings.some((listing) => listing.id === created.listing.id)).toBe(true);
  });

  test('a verified listing is visible to everyone', async () => {
    // business-1 is seeded already verified (see store/seed.ts) -- creating
    // a fresh one here would need a working classifier to ever become
    // verified, which this test isn't about.
    const strangerView = await getBusinessesView(ctx('user-mia'));
    expect(strangerView.listings.some((listing) => listing.id === 'business-1')).toBe(true);
  });

  test('listBusinessesPage applies the same filter and excludes muted authors', async () => {
    const pending = await createBusinessListing(ctx('user-riley'), unresolvedInput);
    if (!pending.ok) throw new Error('setup failed');

    const before = await listBusinessesPage(ctx('user-mia'), { limit: 50 });
    expect(before.listings.some((listing) => listing.id === pending.listing.id)).toBe(false);
    // business-1 is seeded verified, authored by user-jordan.
    expect(before.listings.some((listing) => listing.id === 'business-1')).toBe(true);

    await toggleMute(ctx('user-mia'), 'user-jordan');
    const after = await listBusinessesPage(ctx('user-mia'), { limit: 50 });
    expect(after.listings.some((listing) => listing.id === 'business-1')).toBe(false);
  });

  test('getBusinessesByIds (bookmark hydration) omits a pending listing owned by someone else', async () => {
    const created = await createBusinessListing(ctx('user-riley'), unresolvedInput);
    if (!created.ok) throw new Error('setup failed');

    const asStranger = await getBusinessesByIds(ctx('user-mia'), [created.listing.id]);
    expect(asStranger).toHaveLength(0);

    const asOwner = await getBusinessesByIds(ctx('user-riley'), [created.listing.id]);
    expect(asOwner).toHaveLength(1);
  });

  test('filters by category', async () => {
    const { listings } = await getBusinessesView(ctx(), { category: 'professional-trade' });
    expect(listings.map((listing) => listing.id)).toEqual(['business-2']);
  });
});

describe('rating summary on business listings', () => {
  test('getBusinessesView reports the seeded average rating and review count', async () => {
    const { listings } = await getBusinessesView(ctx());
    const grill = listings.find((listing) => listing.id === 'business-1');
    expect(grill).toMatchObject({ averageRating: 5, reviewCount: 1 });
    const golfCarts = listings.find((listing) => listing.id === 'business-2');
    expect(golfCarts).toMatchObject({ averageRating: 4, reviewCount: 1 });
  });

  test('a listing with no reviews reports a null average and zero count', async () => {
    // business-3 is seeded pending, owned by DEMO_USER_ID -- ctx() defaults
    // to DEMO_USER_ID so it's visible here.
    const { listings } = await getBusinessesView(ctx());
    const pending = listings.find((listing) => listing.id === 'business-3');
    expect(pending).toMatchObject({ averageRating: null, reviewCount: 0 });
  });

  test('a newly created listing has no reviews yet', async () => {
    const result = await createBusinessListing(ctx(), domainMatchedInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.listing).toMatchObject({ averageRating: null, reviewCount: 0 });
  });
});

describe('GET /api/business-listings/:id', () => {
  test('returns the listing when it exists and is visible', async () => {
    const response = await getBusinessListingRoute(
      new Request('http://localhost/api/business-listings/business-1'),
      { id: 'business-1' },
    );
    const body = (await response.json()) as { listing: { id: string } };
    expect(response.status).toBe(200);
    expect(body.listing.id).toBe('business-1');
  });

  test('returns 404 for a pending listing owned by someone else', async () => {
    // business-3 is seeded pending, owned by DEMO_USER_ID; the route always
    // acts as DEMO_USER_ID in this suite, so use a listing pending under a
    // different owner instead.
    const created = await createBusinessListing(ctx('user-riley'), unresolvedInput);
    if (!created.ok) throw new Error('setup failed');

    const response = await getBusinessListingRoute(
      new Request(`http://localhost/api/business-listings/${created.listing.id}`),
      { id: created.listing.id },
    );
    expect(response.status).toBe(404);
  });

  test('returns 404 for an unknown listing id', async () => {
    const response = await getBusinessListingRoute(
      new Request('http://localhost/api/business-listings/does-not-exist'),
      { id: 'does-not-exist' },
    );
    expect(response.status).toBe(404);
  });
});

describe('updateBusinessListing', () => {
  test('the owner can edit their own listing', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');

    const result = await updateBusinessListing(ctx(), created.listing.id, {
      ...domainMatchedInput,
      businessName: 'Renamed Coffee Co',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.businessName).toBe('Renamed Coffee Co');
    }
  });

  test('rejects edits from a user who does not own the listing', async () => {
    const result = await updateBusinessListing(ctx('user-mia'), 'business-1', domainMatchedInput);
    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('returns not_found for an unknown listing', async () => {
    const result = await updateBusinessListing(ctx(), 'business-999', domainMatchedInput);
    expect(result).toMatchObject({ ok: false, code: 'business_listing_not_found' });
  });

  test('editing an unrelated field on a verified listing leaves verification untouched', async () => {
    // business-1 is seeded already verified (see store/seed.ts), owned by
    // user-jordan -- editing a fresh listing here would need a working
    // classifier to ever become verified in the first place.
    const result = await updateBusinessListing(ctx('user-jordan'), 'business-1', {
      businessName: 'Marina Sunset Grill',
      category: 'restaurants-bars',
      description: 'Lakefront dining with a full bar.',
      contactPhone: '(702) 555-0176',
      contactEmail: 'hello@marinasunsetgrill.example',
      contactWebsite: 'https://marinasunsetgrill.example',
      address: '10 Marina Way, Lake Las Vegas Village',
      hours: 'Mon–Sun 11am–10pm',
      currentSpecials: ['New weekend special.'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.verificationStatus).toBe('verified');
      expect(result.listing.currentSpecials).toEqual(['New weekend special.']);
    }
  });

  test('multiple specials round-trip through update, and the 5-item cap is enforced', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');

    const updated = await updateBusinessListing(ctx(), created.listing.id, {
      ...domainMatchedInput,
      currentSpecials: ['Special one', 'Special two', 'Special three'],
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.listing.currentSpecials).toEqual([
        'Special one',
        'Special two',
        'Special three',
      ]);
    }

    const overCap = await updateBusinessListing(ctx(), created.listing.id, {
      ...domainMatchedInput,
      currentSpecials: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
    });
    expect(overCap).toMatchObject({ ok: false, code: 'invalid_business_listing' });
  });

  test('specialsUpdatedAt only changes when the specials list actually changed', async () => {
    const created = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      currentSpecials: ['Half-off pastries before 9am.'],
    });
    if (!created.ok) throw new Error('setup failed');
    const firstStamp = created.listing.specialsUpdatedAt;
    expect(firstStamp).not.toBeNull();

    // Unrelated edit (business name only) -- the specials list is unchanged,
    // so the stamp must not move.
    const unrelatedEdit = await updateBusinessListing(ctx(), created.listing.id, {
      ...domainMatchedInput,
      businessName: 'Renamed Coffee Co',
      currentSpecials: ['Half-off pastries before 9am.'],
    });
    expect(unrelatedEdit.ok).toBe(true);
    if (unrelatedEdit.ok) {
      expect(unrelatedEdit.listing.specialsUpdatedAt).toBe(firstStamp);
    }

    // Actually changing the specials list does move the stamp -- a short
    // delay guarantees the new ISO timestamp differs from firstStamp even
    // at millisecond resolution.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const specialsEdit = await updateBusinessListing(ctx(), created.listing.id, {
      ...domainMatchedInput,
      currentSpecials: ['A different special.'],
    });
    expect(specialsEdit.ok).toBe(true);
    if (specialsEdit.ok) {
      expect(specialsEdit.listing.specialsUpdatedAt).not.toBe(firstStamp);
    }
  });

  test('changing the business name on a verified listing re-triggers verification', async () => {
    // Swap in a mismatched contact email alongside the name change so
    // re-verification actually fails closed to pending, proving it re-ran
    // rather than just leaving the prior 'verified' status in place.
    const result = await updateBusinessListing(ctx('user-jordan'), 'business-1', {
      businessName: 'A Totally Different Name',
      category: 'restaurants-bars',
      description: 'Lakefront dining with a full bar.',
      contactPhone: '(702) 555-0176',
      contactEmail: 'someone@unrelated.example',
      contactWebsite: 'https://marinasunsetgrill.example',
      address: '10 Marina Way, Lake Las Vegas Village',
      hours: 'Mon–Sun 11am–10pm',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.verificationStatus).toBe('pending');
    }
  });
});

describe('getMyBusinessListingsView', () => {
  test("returns only the caller's own listings, pending or verified", async () => {
    const demoPage = await getMyBusinessListingsView(ctx());
    expect(demoPage.listings.map((listing) => listing.id)).toEqual(['business-3']);

    const jordanPage = await getMyBusinessListingsView(ctx('user-jordan'));
    expect(jordanPage.listings.map((listing) => listing.id)).toEqual(['business-1']);
  });
});

describe('deleteBusinessListing', () => {
  test('the owner can delete their own listing', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');

    expect(await deleteBusinessListing(ctx(), created.listing.id)).toBe(true);
    expect(
      (await getBusinessesView(ctx())).listings.some(
        (listing) => listing.id === created.listing.id,
      ),
    ).toBe(false);
  });

  test('returns false for a user who does not own the listing', async () => {
    expect(await deleteBusinessListing(ctx('user-mia'), 'business-1')).toBe(false);
  });

  test('cleans up reports for the deleted listing', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');
    await reportBusinessListing(ctx('user-mia'), created.listing.id, TEST_REPORT_SUBMISSION);

    await deleteBusinessListing(ctx(), created.listing.id);

    expect(
      getState().businessListingReports.some(
        (report) => report.businessListingId === created.listing.id,
      ),
    ).toBe(false);
  });

  test('cascades: deleting a listing also removes its reviews', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');
    const review = await createBusinessListingReview(ctx('user-mia'), created.listing.id, {
      body: 'Great job!',
      rating: 5,
    });
    if (!review.ok) throw new Error('setup failed');

    expect(await deleteBusinessListing(ctx(), created.listing.id)).toBe(true);
    expect(await listBusinessListingReviews(ctx(), created.listing.id)).toEqual([]);
    expect(
      getState().businessListingReviews.some((r) => r.id === review.review.id),
    ).toBe(false);
  });
});

describe('reportBusinessListing', () => {
  test('reports an existing listing', async () => {
    const result = await reportBusinessListing(
      ctx('user-mia'),
      'business-1',
      TEST_REPORT_SUBMISSION,
    );

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().businessListingReports.some(
        (report) =>
          report.businessListingId === 'business-1' && report.reporterId === 'user-mia',
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same listing twice records one report', async () => {
    await reportBusinessListing(ctx('user-mia'), 'business-1', TEST_REPORT_SUBMISSION);
    await reportBusinessListing(ctx('user-mia'), 'business-1', TEST_REPORT_SUBMISSION);

    expect(
      getState().businessListingReports.filter(
        (report) =>
          report.businessListingId === 'business-1' && report.reporterId === 'user-mia',
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown listing', async () => {
    const result = await reportBusinessListing(ctx(), 'business-nope', TEST_REPORT_SUBMISSION);
    expect(result).toMatchObject({ ok: false, code: 'business_listing_not_found' });
  });
});

describe('business listing routes', () => {
  test('GET/POST /api/business-listings and PATCH/DELETE /api/business-listings/:id', async () => {
    const created = await postBusinessListing(
      new Request('http://localhost/api/business-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(domainMatchedInput),
      }),
    );
    expect(created.status).toBe(201);
    const { listing, xpAward } = (await created.json()) as {
      listing: { id: string };
      xpAward: { awardedXp: number };
    };
    expect(xpAward.awardedXp).toBe(CREATE_CONTENT_XP);

    const listed = await getBusinessListings(
      new Request('http://localhost/api/business-listings'),
    );
    const { listings } = (await listed.json()) as { listings: readonly { id: string }[] };
    expect(listings.some((entry) => entry.id === listing.id)).toBe(true);

    const patched = await patchBusinessListingRoute(
      new Request(`http://localhost/api/business-listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...domainMatchedInput, businessName: 'Renamed' }),
      }),
      { id: listing.id },
    );
    expect(patched.status).toBe(200);

    const removed = await deleteBusinessListingRoute(
      new Request(`http://localhost/api/business-listings/${listing.id}`, {
        method: 'DELETE',
      }),
      { id: listing.id },
    );
    expect(removed.status).toBe(200);
  });

  test('PATCH returns 403 for a listing owned by someone else', async () => {
    const response = await patchBusinessListingRoute(
      new Request('http://localhost/api/business-listings/business-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(domainMatchedInput),
      }),
      { id: 'business-1' },
    );
    expect(response.status).toBe(403);
  });

  test('POST returns 400 for an invalid listing', async () => {
    const response = await postBusinessListing(
      new Request('http://localhost/api/business-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...domainMatchedInput, businessName: '' }),
      }),
    );
    expect(response.status).toBe(400);
  });

  test('GET honors ?limit and ?category together', async () => {
    const response = await getBusinessListings(
      new Request(
        'http://localhost/api/business-listings?limit=1&category=professional-trade',
      ),
    );
    const body = (await response.json()) as {
      listings: readonly { id: string }[];
      nextCursor: string | null;
    };
    expect(response.status).toBe(200);
    expect(body.listings).toEqual([expect.objectContaining({ id: 'business-2' })]);
  });

  test('report route reports a listing', async () => {
    const response = await reportBusinessListingRoute(
      new Request('http://localhost/api/business-listings/business-1/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'other' }),
      }),
      { id: 'business-1' },
    );
    expect(response.status).toBe(200);
  });

  test('mine route returns a bounded page shape', async () => {
    const response = await getMyBusinessListingsRoute(
      new Request('http://localhost/api/business-listings/mine'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      listings: readonly unknown[];
      nextCursor: string | null;
    };
    expect(Array.isArray(body.listings)).toBe(true);
  });
});

describe('listBusinessListingReviews', () => {
  test('returns the seeded review for business-1, newest first', async () => {
    await createBusinessListingReview(ctx('user-andre'), 'business-1', {
      body: 'Second opinion',
      rating: 4,
    });

    const reviews = await listBusinessListingReviews(ctx(), 'business-1');
    expect(reviews.map((review) => review.body)).toEqual([
      'Second opinion',
      'Best patio on the lake — the happy hour app specials are unbeatable.',
    ]);
  });

  test('hides reviews from an author the viewer has muted', async () => {
    await createBusinessListingReview(ctx('user-andre'), 'business-1', {
      body: 'Second opinion',
      rating: 4,
    });

    await toggleMute(ctx(), 'user-andre');

    const reviews = await listBusinessListingReviews(ctx(), 'business-1');
    expect(reviews.some((review) => review.author.id === 'user-andre')).toBe(
      false,
    );
  });

  test('hides reviews on a pending listing from everyone but its owner', async () => {
    const created = await createBusinessListing(ctx('user-riley'), unresolvedInput);
    if (!created.ok) throw new Error('setup failed');
    const review = await createBusinessListingReview(ctx('user-mia'), created.listing.id, {
      body: 'nice',
      rating: 5,
    });
    if (!review.ok) throw new Error('setup failed');

    expect(await listBusinessListingReviews(ctx('user-mia'), created.listing.id)).toEqual([]);
    expect(
      (await listBusinessListingReviews(ctx('user-riley'), created.listing.id)).map(
        (r) => r.id,
      ),
    ).toEqual([review.review.id]);
  });
});

describe('listBusinessListingReviewsPage', () => {
  test('paginates newest-first and preserves that order across pages', async () => {
    await createBusinessListingReview(ctx('user-andre'), 'business-1', {
      body: 'Second opinion',
      rating: 4,
    });

    const first = await listBusinessListingReviewsPage(ctx(), 'business-1', { limit: 1 });
    expect(first.reviews.map((review) => review.body)).toEqual([
      'Second opinion',
    ]);
    expect(first.nextCursor).not.toBeNull();

    const second = await listBusinessListingReviewsPage(ctx(), 'business-1', {
      cursor: first.nextCursor,
      limit: 1,
    });
    expect(second.reviews.map((review) => review.body)).toEqual([
      'Best patio on the lake — the happy hour app specials are unbeatable.',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  test('hides reviews from an author the viewer has muted', async () => {
    await createBusinessListingReview(ctx('user-andre'), 'business-1', {
      body: 'Second opinion',
      rating: 4,
    });

    await toggleMute(ctx(), 'user-andre');

    const page = await listBusinessListingReviewsPage(ctx(), 'business-1');
    expect(
      page.reviews.some((review) => review.author.id === 'user-andre'),
    ).toBe(false);
  });

  test('returns an empty page for a listing with no reviews', async () => {
    // business-3 is seeded pending, owned by DEMO_USER_ID -- ctx() defaults
    // to DEMO_USER_ID so it's visible here.
    const page = await listBusinessListingReviewsPage(ctx(), 'business-3');
    expect(page.reviews).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

describe('createBusinessListingReview', () => {
  test('allows a rating with no body — text is optional, unlike a comment', async () => {
    const result = await createBusinessListingReview(ctx(), 'business-1', {
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
      await createBusinessListingReview(ctx(), 'business-1', {
        body: 'x'.repeat(1001),
        rating: 5,
      }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a rating outside 1-5', async () => {
    expect(
      await createBusinessListingReview(ctx(), 'business-1', { body: 'nice', rating: 6 }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a review with no rating at all — text alone is not a complete review', async () => {
    expect(
      await createBusinessListingReview(ctx(), 'business-1', { body: 'nice' }),
    ).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('rejects a review on an unknown listing', async () => {
    expect(
      await createBusinessListingReview(ctx(), 'business-nope', { body: 'nice', rating: 5 }),
    ).toMatchObject({ ok: false, code: 'business_listing_not_found' });
  });

  test('creates a review attributed to the acting user', async () => {
    const result = await createBusinessListingReview(ctx(), 'business-1', {
      body: ' Fast and friendly! ',
      rating: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.review).toMatchObject({
      listingId: 'business-1',
      author: { id: DEMO_USER_ID, name: 'You' },
      body: 'Fast and friendly!',
      rating: 5,
    });
  });

  test('rejects reviewing your own listing', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');

    const result = await createBusinessListingReview(ctx(), created.listing.id, {
      body: 'nice',
      rating: 5,
    });

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('rejects a second review from the same author on the same listing', async () => {
    // business-2 already has a seeded review authored by DEMO_USER_ID.
    const result = await createBusinessListingReview(ctx(), 'business-2', {
      body: 'trying again',
      rating: 1,
    });

    expect(result).toMatchObject({ ok: false, code: 'already_reviewed' });
  });
});

describe('updateBusinessListingReview', () => {
  test('the author can edit their own review', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateBusinessListingReview(ctx(), created.review.id, {
      body: 'updated',
      rating: 5,
    });

    expect(result).toMatchObject({
      ok: true,
      review: { body: 'updated', rating: 5 },
    });
  });

  test('stamps editedAt on update, unset until then', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');
    expect(created.review.editedAt).toBeNull();

    const result = await updateBusinessListingReview(ctx(), created.review.id, {
      body: 'updated',
      rating: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.editedAt).not.toBeNull();
    }
  });

  test('rejects edits from a user who does not own the review', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateBusinessListingReview(ctx('user-mia'), created.review.id, {
      body: 'hijacked',
      rating: 1,
    });

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('rejects an invalid rating', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateBusinessListingReview(ctx(), created.review.id, {
      body: 'still mine',
      rating: 9,
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_review' });
  });

  test('returns not_found for an unknown review', async () => {
    const result = await updateBusinessListingReview(ctx(), 'business-review-nope', {
      body: 'x',
      rating: 3,
    });

    expect(result).toMatchObject({ ok: false, code: 'business_listing_review_not_found' });
  });

  test('can clear the body down to a rating-only review', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateBusinessListingReview(ctx(), created.review.id, {
      body: '   ',
      rating: 4,
    });

    expect(result).toMatchObject({ ok: true, review: { body: null, rating: 4 } });
  });
});

describe('deleteBusinessListingReview', () => {
  test('deletes only the author’s own review', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    expect(await deleteBusinessListingReview(ctx('user-mia'), created.review.id)).toBe(false);
    expect(await deleteBusinessListingReview(ctx(), created.review.id)).toBe(true);
    const remaining = await listBusinessListingReviews(ctx(), 'business-1');
    expect(remaining.some((review) => review.id === created.review.id)).toBe(false);
  });

  test('returns false for an unknown review', async () => {
    expect(await deleteBusinessListingReview(ctx(), 'business-review-nope')).toBe(false);
  });
});

describe('reportBusinessListingReview', () => {
  test('reports an existing review', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await reportBusinessListingReview(
      ctx('user-andre'),
      created.review.id,
      TEST_REPORT_SUBMISSION,
    );

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().businessListingReviewReports.some(
        (report) =>
          report.businessListingReviewId === created.review.id &&
          report.reporterId === 'user-andre',
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same review twice records one report', async () => {
    const created = await createBusinessListingReview(ctx(), 'business-1', {
      body: 'mine',
      rating: 3,
    });
    if (!created.ok) throw new Error('setup failed');

    await reportBusinessListingReview(ctx('user-andre'), created.review.id, TEST_REPORT_SUBMISSION);
    await reportBusinessListingReview(ctx('user-andre'), created.review.id, TEST_REPORT_SUBMISSION);

    expect(
      getState().businessListingReviewReports.filter(
        (report) =>
          report.businessListingReviewId === created.review.id &&
          report.reporterId === 'user-andre',
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown review', async () => {
    const result = await reportBusinessListingReview(
      ctx(),
      'business-review-nope',
      TEST_REPORT_SUBMISSION,
    );

    expect(result).toMatchObject({ ok: false, code: 'business_listing_review_not_found' });
  });
});

describe('business listing review routes', () => {
  test('GET returns { reviews }; POST creates 201; DELETE removes; report is 200', async () => {
    const created = await postBusinessListingReview(
      new Request('http://localhost/api/business-listings/business-1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Looking sharp', rating: 5 }),
      }),
      { id: 'business-1' },
    );
    expect(created.status).toBe(201);
    const { review } = (await created.json()) as { review: { id: string } };

    const listed = await getBusinessListingReviews(
      new Request('http://localhost/api/business-listings/business-1/reviews'),
      { id: 'business-1' },
    );
    const { reviews } = (await listed.json()) as {
      reviews: readonly { id: string }[];
    };
    expect(reviews[0]?.id).toBe(review.id);

    const reported = await reportBusinessListingReviewRoute(
      new Request(`http://localhost/api/business-listing-reviews/${review.id}/report`, {
        body: JSON.stringify({ reason: 'other' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
      { id: review.id },
    );
    expect(reported.status).toBe(200);

    const patched = await patchBusinessListingReviewRoute(
      new Request(`http://localhost/api/business-listing-reviews/${review.id}`, {
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

    const removed = await deleteBusinessListingReviewRoute(
      new Request(`http://localhost/api/business-listing-reviews/${review.id}`, {
        method: 'DELETE',
      }),
      { id: review.id },
    );
    expect(removed.status).toBe(200);
  });

  test('GET honors ?limit and ?cursor for pagination', async () => {
    await postBusinessListingReview(
      new Request('http://localhost/api/business-listings/business-1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Second opinion', rating: 4 }),
      }),
      { id: 'business-1' },
    );

    const firstResponse = await getBusinessListingReviews(
      new Request('http://localhost/api/business-listings/business-1/reviews?limit=1'),
      { id: 'business-1' },
    );
    const first = (await firstResponse.json()) as {
      reviews: readonly { body: string | null }[];
      nextCursor: string | null;
    };
    expect(first.reviews.map((review) => review.body)).toEqual([
      'Second opinion',
    ]);
    expect(first.nextCursor).not.toBeNull();

    const secondResponse = await getBusinessListingReviews(
      new Request(
        `http://localhost/api/business-listings/business-1/reviews?limit=1&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
      ),
      { id: 'business-1' },
    );
    const second = (await secondResponse.json()) as {
      reviews: readonly { body: string | null }[];
      nextCursor: string | null;
    };
    expect(second.reviews.map((review) => review.body)).toEqual([
      'Best patio on the lake — the happy hour app specials are unbeatable.',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  test('POST review returns 404 for an unknown listing', async () => {
    const response = await postBusinessListingReview(
      new Request('http://localhost/api/business-listings/business-nope/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'hi', rating: 5 }),
      }),
      { id: 'business-nope' },
    );
    expect(response.status).toBe(404);
  });
});

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
import { GET as getMyBusinessListingsRoute } from '../../app/api/business-listings/mine+api';
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
  test('a matching contact-email domain verifies instantly via domain_match', async () => {
    const result = await createBusinessListing(ctx(), domainMatchedInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.listing).toMatchObject({
      verificationStatus: 'verified',
      verificationMethod: 'domain_match',
    });
    expect(result.listing.verifiedAt).not.toBeNull();
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

  test('stores and clears the current special, stamping specialUpdatedAt', async () => {
    const created = await createBusinessListing(ctx(), {
      ...domainMatchedInput,
      currentSpecial: 'Half-off pastries before 9am.',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.listing.currentSpecial).toBe('Half-off pastries before 9am.');
    expect(created.listing.specialUpdatedAt).not.toBeNull();
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
    const created = await createBusinessListing(ctx('user-riley'), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');

    const strangerView = await getBusinessesView(ctx('user-mia'));
    expect(strangerView.listings.some((listing) => listing.id === created.listing.id)).toBe(
      true,
    );
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
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');
    expect(created.listing.verificationStatus).toBe('verified');

    const result = await updateBusinessListing(ctx(), created.listing.id, {
      ...domainMatchedInput,
      currentSpecial: 'New weekend special.',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.listing.verificationStatus).toBe('verified');
      expect(result.listing.currentSpecial).toBe('New weekend special.');
    }
  });

  test('changing the business name on a verified listing re-triggers verification', async () => {
    const created = await createBusinessListing(ctx(), domainMatchedInput);
    if (!created.ok) throw new Error('setup failed');
    expect(created.listing.verificationStatus).toBe('verified');

    // Swap in a mismatched contact email alongside the name change so
    // re-verification actually fails closed to pending, proving it re-ran
    // rather than just leaving the prior 'verified' status in place.
    const result = await updateBusinessListing(ctx(), created.listing.id, {
      ...domainMatchedInput,
      businessName: 'A Totally Different Name',
      contactEmail: 'someone@unrelated.example',
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

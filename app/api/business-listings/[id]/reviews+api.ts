import { createBusinessListingReview, listBusinessListingReviewsPage } from '@/src/backend/business-listing-reviews';
import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listBusinessListingReviewsPage(ctx, id, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
  });
}

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.review,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many reviews. Try again shortly.');
    }

    const body: unknown = await request.json().catch(() => null);
    const result = await createBusinessListingReview(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'business_listing_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ review: result.review }, { status: 201 });
  });
}

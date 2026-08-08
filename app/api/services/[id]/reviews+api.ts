import { createServiceReview, listServiceReviews } from '@/src/backend/service-reviews';
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
  return withRequestContext(request, async (ctx) =>
    jsonOk({ reviews: await listServiceReviews(ctx, id) }),
  );
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
    const result = await createServiceReview(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'service_listing_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ review: result.review }, { status: 201 });
  });
}

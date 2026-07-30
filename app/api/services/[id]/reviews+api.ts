import { createServiceReview, listServiceReviews } from '@/src/backend/service-reviews';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

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
    const body: unknown = await request.json().catch(() => null);
    const result = await createServiceReview(ctx, id, body);

    if (!result.ok) {
      return jsonError(
        result.code === 'service_listing_not_found' ? 404 : 400,
        result.code,
        result.message,
      );
    }
    return jsonOk({ review: result.review }, { status: 201 });
  });
}

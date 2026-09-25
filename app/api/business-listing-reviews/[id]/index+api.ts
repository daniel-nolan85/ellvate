import { deleteBusinessListingReview, updateBusinessListingReview } from '@/src/backend/business-listing-reviews';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updateBusinessListingReview(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'business_listing_review_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ review: result.review });
  });
}

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deleteBusinessListingReview(ctx, id);

    if (!deleted) {
      return jsonError(404, 'business_listing_review_not_found', 'Review not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

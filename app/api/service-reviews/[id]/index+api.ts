import { deleteServiceReview, updateServiceReview } from '@/src/backend/service-reviews';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updateServiceReview(ctx, id, body);

    if (!result.ok) {
      const status = result.code === 'service_review_not_found' ? 404 : 400;
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
    const deleted = await deleteServiceReview(ctx, id);

    if (!deleted) {
      return jsonError(404, 'service_review_not_found', 'Review not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

import {
  deleteServiceListing,
  getServicesByIds,
  updateServiceListing,
} from '@/src/backend/services';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const [listing] = await getServicesByIds(ctx, [id]);
    if (!listing) {
      return jsonError(404, 'service_listing_not_found', 'Listing not found.');
    }
    return jsonOk({ listing });
  });
}

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updateServiceListing(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'service_listing_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ listing: result.listing });
  });
}

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deleteServiceListing(ctx, id);
    if (!deleted) {
      return jsonError(404, 'service_listing_not_found', 'Listing not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

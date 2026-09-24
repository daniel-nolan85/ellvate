import {
  deleteBusinessListing,
  getBusinessesByIds,
  updateBusinessListing,
} from '@/src/backend/business-listings';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const [listing] = await getBusinessesByIds(ctx, [id]);
    if (!listing) {
      return jsonError(404, 'business_listing_not_found', 'Listing not found.');
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
    const result = await updateBusinessListing(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'business_listing_not_found'
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
    const deleted = await deleteBusinessListing(ctx, id);
    if (!deleted) {
      return jsonError(404, 'business_listing_not_found', 'Listing not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { createServiceListing, getServicesView } from '@/src/backend/services';
import type { ServiceCategory } from '@/src/backend/store';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    return jsonOk(
      await getServicesView(ctx, {
        category: category ? (category as ServiceCategory) : undefined,
      }),
    );
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await createServiceListing(ctx, body);

    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }
    return jsonOk({ listing: result.listing }, { status: 201 });
  });
}

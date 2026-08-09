import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { createServiceListing, listServicesPage } from '@/src/backend/services';
import type { ServiceCategory } from '@/src/backend/store';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listServicesPage(ctx, {
      category: category ? (category as ServiceCategory) : undefined,
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
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

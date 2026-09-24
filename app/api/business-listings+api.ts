import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';
import { createBusinessListing, listBusinessesPage } from '@/src/backend/business-listings';
import type { BusinessCategory } from '@/src/backend/store';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listBusinessesPage(ctx, {
      category: category ? (category as BusinessCategory) : undefined,
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.businessListing,
    );
    if (rateLimit === 'limited') {
      return jsonError(
        429,
        'rate_limited',
        'Too many listings created. Try again shortly.',
      );
    }

    const body: unknown = await request.json().catch(() => null);
    const result = await createBusinessListing(ctx, body);

    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }
    return jsonOk({ listing: result.listing, xpAward: result.xpAward }, { status: 201 });
  });
}

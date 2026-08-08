import { createPost, listPostsPage } from '@/src/backend/forum';
import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listPostsPage(ctx, {
      cursor: url.searchParams.get('cursor'),
      forum: url.searchParams.get('forum') ?? undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.post,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many posts. Try again shortly.');
    }

    const body: unknown = await request.json().catch(() => null);
    const result = await createPost(ctx, body);

    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }
    return jsonOk({ post: result.post }, { status: 201 });
  });
}

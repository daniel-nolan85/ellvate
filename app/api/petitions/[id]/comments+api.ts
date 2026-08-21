import { createPetitionComment, listPetitionCommentsPage } from '@/src/backend/petition-comments';
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
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listPetitionCommentsPage(ctx, id, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
  });
}

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.comment,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many comments. Try again shortly.');
    }

    const body: unknown = await request.json().catch(() => null);
    const result = await createPetitionComment(ctx, id, body);

    if (!result.ok) {
      const status = result.code === 'petition_not_found' ? 404 : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ comment: result.comment }, { status: 201 });
  });
}

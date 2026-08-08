import { createMissionComment, listMissionComments } from '@/src/backend/mission-comments';
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
  return withRequestContext(request, async (ctx) =>
    jsonOk({ comments: await listMissionComments(ctx, id) }),
  );
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
    const result = await createMissionComment(ctx, id, body);

    if (!result.ok) {
      return jsonError(
        result.code === 'mission_not_found' ? 404 : 400,
        result.code,
        result.message,
      );
    }
    return jsonOk({ comment: result.comment }, { status: 201 });
  });
}

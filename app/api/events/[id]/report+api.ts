import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';
import { reportEvent } from '@/src/backend/events';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.report,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many reports. Try again shortly.');
    }

    const result = await reportEvent(ctx, id);
    if (!result.ok) {
      return jsonError(404, result.code, result.message);
    }
    return jsonOk({ reported: result.reported });
  });
}

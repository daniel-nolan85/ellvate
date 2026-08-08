import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';
import { createMission, getMissionsView } from '@/src/backend/missions';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => jsonOk(await getMissionsView(ctx)));
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.post,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many missions created. Try again shortly.');
    }

    const body: unknown = await request.json().catch(() => null);
    const result = await createMission(ctx, body);

    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }
    return jsonOk({ mission: result.mission }, { status: 201 });
  });
}

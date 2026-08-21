import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';
import { submitContactMessage } from '@/src/backend/contact';

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.contact,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many messages. Try again shortly.');
    }

    const body: unknown = await request.json().catch(() => null);
    const { category, message } =
      body && typeof body === 'object'
        ? (body as { category?: unknown; message?: unknown })
        : {};

    const result = await submitContactMessage(ctx, category, message);
    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }
    return jsonOk({ id: result.id }, { status: 201 });
  });
}

import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';
import { storePushToken } from '@/src/backend/push';

export async function POST(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  const body: unknown = await request.json().catch(() => null);
  const result = await storePushToken(ctx, body);

  if (!result.ok) {
    return jsonError(400, result.code, result.message);
  }
  return jsonOk({ ok: true }, { status: 201 });
}

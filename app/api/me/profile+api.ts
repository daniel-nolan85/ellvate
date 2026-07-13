import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';
import { getProfile, updateProfile } from '@/src/backend/profile';

export async function GET(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk(await getProfile(ctx));
}

export async function PUT(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) {
    return jsonError(400, 'invalid_json', 'Request body must be valid JSON.');
  }

  const result = await updateProfile(ctx, body);
  if (!result.ok) {
    return jsonError(400, result.code, result.message);
  }

  return jsonOk({ profile: result.profile });
}

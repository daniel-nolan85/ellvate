import { getRequestUserId, jsonError, jsonOk } from '@/src/backend/http';
import { getProfile, updateProfile } from '@/src/backend/profile';

export async function GET(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  return jsonOk(getProfile(userId));
}

export async function PUT(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  const body: unknown = await request.json().catch(() => undefined);
  if (body === undefined) {
    return jsonError(400, 'invalid_json', 'Request body must be valid JSON.');
  }

  const result = updateProfile(userId, body);
  if (!result.ok) {
    return jsonError(400, result.code, result.message);
  }

  return jsonOk({ profile: result.profile });
}

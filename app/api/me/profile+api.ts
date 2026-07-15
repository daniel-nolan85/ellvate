import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { getProfile, updateProfile } from '@/src/backend/profile';
import { consumeProfileSyncFailure } from '@/src/backend/testing';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => jsonOk(await getProfile(ctx)));
}

export async function PUT(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => undefined);
    if (body === undefined) {
      return jsonError(400, 'invalid_json', 'Request body must be valid JSON.');
    }

    if (consumeProfileSyncFailure(ctx.userId)) {
      return jsonError(
        503,
        'profile_sync_unavailable',
        'Profile sync is temporarily unavailable. Try again.',
      );
    }

    const result = await updateProfile(ctx, body);
    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }

    return jsonOk({ profile: result.profile });
  });
}

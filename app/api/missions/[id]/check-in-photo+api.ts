import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { getMyCheckInPhoto, updateMyCheckInPhoto } from '@/src/backend/missions';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const result = await getMyCheckInPhoto(ctx, id);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return jsonOk(result.body);
  });
}

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updateMyCheckInPhoto(ctx, id, body);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return jsonOk(result.body);
  });
}

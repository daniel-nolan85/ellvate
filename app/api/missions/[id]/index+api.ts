import { deleteMission, updateMission } from '@/src/backend/missions';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updateMission(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'mission_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ mission: result.mission });
  });
}

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deleteMission(ctx, id);
    if (!deleted) {
      return jsonError(404, 'mission_not_found', 'Mission not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

import { listMissionCheckIns } from '@/src/backend/missions';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ checkIns: await listMissionCheckIns(ctx, id) }),
  );
}

import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getUserProgress } from '@/src/backend/missions';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ progress: await getUserProgress(ctx) }),
  );
}

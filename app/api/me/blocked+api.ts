import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getBlockedMembers } from '@/src/backend/profile';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ blocked: await getBlockedMembers(ctx) }),
  );
}

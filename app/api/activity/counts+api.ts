import { getMyActivityCounts } from '@/src/backend/activity';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const counts = await getMyActivityCounts(ctx);
    return jsonOk(counts);
  });
}

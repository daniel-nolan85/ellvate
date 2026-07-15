import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getLeaderboard } from '@/src/backend/leaderboard';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => jsonOk(await getLeaderboard(ctx)));
}

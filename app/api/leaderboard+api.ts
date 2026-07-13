import { createRequestContext, jsonOk } from '@/src/backend/http';
import { getLeaderboard } from '@/src/backend/leaderboard';

export async function GET(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk(await getLeaderboard(ctx));
}

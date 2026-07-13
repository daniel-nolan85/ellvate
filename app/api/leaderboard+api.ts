import { getRequestUserId, jsonOk } from '@/src/backend/http';
import { getLeaderboard } from '@/src/backend/leaderboard';

export async function GET(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  return jsonOk(getLeaderboard(userId));
}

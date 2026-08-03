import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getLeaderboard, type LeaderboardRange } from '@/src/backend/leaderboard';

const RANGES: readonly LeaderboardRange[] = ['week', 'month', 'all'];

const parseRange = (value: string | null): LeaderboardRange =>
  (RANGES as readonly string[]).includes(value ?? '')
    ? (value as LeaderboardRange)
    : 'all';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const range = parseRange(new URL(request.url).searchParams.get('range'));
    return jsonOk(await getLeaderboard(ctx, range));
  });
}

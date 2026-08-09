import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getLeaderboardPage, type LeaderboardRange } from '@/src/backend/leaderboard';

const RANGES: readonly LeaderboardRange[] = ['week', 'month', 'all'];

const parseRange = (value: string | null): LeaderboardRange =>
  (RANGES as readonly string[]).includes(value ?? '')
    ? (value as LeaderboardRange)
    : 'all';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const range = parseRange(url.searchParams.get('range'));
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await getLeaderboardPage(ctx, range, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
  });
}

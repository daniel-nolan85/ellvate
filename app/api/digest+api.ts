import { getWeeklyDigest } from '@/src/backend/digest';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { isDateOnly } from '@/src/lib/date-only';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const weekStart = url.searchParams.get('weekStart') ?? undefined;
    if (weekStart !== undefined && !isDateOnly(weekStart)) {
      return jsonError(400, 'invalid_week_start', 'weekStart must be a YYYY-MM-DD date.');
    }
    const digest = await getWeeklyDigest(ctx, { weekStart });
    return jsonOk(digest);
  });
}

import { getWeeklyDigest } from '@/src/backend/digest';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const weekStart = url.searchParams.get('weekStart') ?? undefined;
    const digest = await getWeeklyDigest(ctx, { weekStart });
    return jsonOk(digest);
  });
}

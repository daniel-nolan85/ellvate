import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getMyMissionsView } from '@/src/backend/missions';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await getMyMissionsView(ctx, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
  });
}

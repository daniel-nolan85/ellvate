import { toggleBookmark } from '@/src/backend/bookmarks';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await toggleBookmark(ctx, body);

    if (!result.ok) {
      return jsonError(
        result.code === 'target_not_found' ? 404 : 400,
        result.code,
        result.message,
      );
    }
    return jsonOk({ bookmarked: result.bookmarked });
  });
}

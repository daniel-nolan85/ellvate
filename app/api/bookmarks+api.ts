import { listBookmarks } from '@/src/backend/bookmarks';
import { jsonOk, withRequestContext } from '@/src/backend/http';
import type { BookmarkTargetType } from '@/src/backend/store';

const isBookmarkTargetType = (value: string | null): value is BookmarkTargetType =>
  value === 'post' || value === 'event' || value === 'mission';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const targetTypeParam = url.searchParams.get('targetType');
    const page = await listBookmarks(ctx, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      targetType: isBookmarkTargetType(targetTypeParam) ? targetTypeParam : undefined,
    });
    return jsonOk(page);
  });
}

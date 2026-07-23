import { listBookmarkIds } from '@/src/backend/bookmarks';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ ids: await listBookmarkIds(ctx) }),
  );
}

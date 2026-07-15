import { toggleLike } from '@/src/backend/forum';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const result = await toggleLike(ctx, id);

    if (!result) {
      return jsonError(404, 'post_not_found', 'Post not found.');
    }
    return jsonOk(result);
  });
}

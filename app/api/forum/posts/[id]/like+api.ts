import { toggleLike } from '@/src/backend/forum';
import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  const ctx = await createRequestContext(request);
  const result = await toggleLike(ctx, id);

  if (!result) {
    return jsonError(404, 'post_not_found', 'Post not found.');
  }
  return jsonOk(result);
}

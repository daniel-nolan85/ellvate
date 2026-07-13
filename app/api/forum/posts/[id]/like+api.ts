import { toggleLike } from '@/src/backend/forum';
import { getRequestUserId, jsonError, jsonOk } from '@/src/backend/http';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  const userId = await getRequestUserId(request);
  const result = toggleLike(userId, id);

  if (!result) {
    return jsonError(404, 'post_not_found', 'Post not found.');
  }

  return jsonOk(result);
}

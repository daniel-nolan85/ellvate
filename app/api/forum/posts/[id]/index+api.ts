import { deletePost, updatePost } from '@/src/backend/forum';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updatePost(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'post_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ post: result.post });
  });
}

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deletePost(ctx, id);
    if (!deleted) {
      return jsonError(404, 'post_not_found', 'Post not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

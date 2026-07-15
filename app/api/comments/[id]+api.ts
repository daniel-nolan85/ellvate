import { deleteComment } from '@/src/backend/comments';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deleteComment(ctx, id);

    if (!deleted) {
      return jsonError(404, 'comment_not_found', 'Comment not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

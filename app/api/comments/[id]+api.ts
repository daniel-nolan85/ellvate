import { deleteComment } from '@/src/backend/comments';
import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  const ctx = await createRequestContext(request);
  const deleted = await deleteComment(ctx, id);

  if (!deleted) {
    return jsonError(404, 'comment_not_found', 'Comment not found.');
  }
  return jsonOk({ deleted: true, id });
}

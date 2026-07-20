import { deleteEventComment } from '@/src/backend/event-comments';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deleteEventComment(ctx, id);

    if (!deleted) {
      return jsonError(404, 'event_comment_not_found', 'Comment not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

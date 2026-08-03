import { deleteEventComment, updateEventComment } from '@/src/backend/event-comments';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updateEventComment(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'event_comment_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ comment: result.comment });
  });
}

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

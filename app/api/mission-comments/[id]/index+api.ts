import { deleteMissionComment } from '@/src/backend/mission-comments';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deleteMissionComment(ctx, id);

    if (!deleted) {
      return jsonError(404, 'mission_comment_not_found', 'Comment not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

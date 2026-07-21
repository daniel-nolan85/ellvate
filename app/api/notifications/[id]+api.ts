import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { markNotificationRead } from '@/src/backend/notifications';

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const updated = await markNotificationRead(ctx, id);
    if (!updated) {
      return jsonError(404, 'notification_not_found', 'Notification not found.');
    }
    return jsonOk({ id, read: true });
  });
}

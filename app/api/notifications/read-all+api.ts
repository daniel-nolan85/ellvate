import { jsonOk, withRequestContext } from '@/src/backend/http';
import { markAllNotificationsRead } from '@/src/backend/notifications';

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const count = await markAllNotificationsRead(ctx);
    return jsonOk({ count });
  });
}

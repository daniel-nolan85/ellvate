import { jsonOk, withRequestContext } from '@/src/backend/http';
import { listNotifications } from '@/src/backend/notifications';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    return jsonOk({ notifications: await listNotifications(ctx) });
  });
}

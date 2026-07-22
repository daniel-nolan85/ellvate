import { jsonOk, withRequestContext } from '@/src/backend/http';
import { countUnreadNotifications } from '@/src/backend/notifications';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ count: await countUnreadNotifications(ctx) }),
  );
}

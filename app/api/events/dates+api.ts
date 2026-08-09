import { getEventDates } from '@/src/backend/events';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ dates: await getEventDates(ctx) }),
  );
}

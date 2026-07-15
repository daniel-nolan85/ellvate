import { toggleJoin } from '@/src/backend/events';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const result = await toggleJoin(ctx, id);

    if (!result) {
      return jsonError(404, 'event_not_found', 'Event not found.');
    }

    return jsonOk(result);
  });
}

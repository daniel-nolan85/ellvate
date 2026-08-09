import { getEventAttendeesPage } from '@/src/backend/events';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await getEventAttendeesPage(ctx, id, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });

    if (!page) {
      return jsonError(404, 'event_not_found', 'Event not found.');
    }

    return jsonOk(page);
  });
}

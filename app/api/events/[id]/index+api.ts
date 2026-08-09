import { deleteEvent, getEventsByIds, updateEvent } from '@/src/backend/events';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const [event] = await getEventsByIds(ctx, [id]);
    if (!event) {
      return jsonError(404, 'event_not_found', 'Event not found.');
    }
    return jsonOk({ event });
  });
}

export async function PATCH(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const body: unknown = await request.json().catch(() => null);
    const result = await updateEvent(ctx, id, body);

    if (!result.ok) {
      const status =
        result.code === 'event_not_found'
          ? 404
          : result.code === 'forbidden'
            ? 403
            : 400;
      return jsonError(status, result.code, result.message);
    }
    return jsonOk({ event: result.event });
  });
}

export async function DELETE(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const deleted = await deleteEvent(ctx, id);
    if (!deleted) {
      return jsonError(404, 'event_not_found', 'Event not found.');
    }
    return jsonOk({ deleted: true, id });
  });
}

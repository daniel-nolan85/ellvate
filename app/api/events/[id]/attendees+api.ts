import { getEventAttendees } from '@/src/backend/events';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const attendees = await getEventAttendees(ctx, id);

    if (!attendees) {
      return jsonError(404, 'event_not_found', 'Event not found.');
    }

    return jsonOk({ attendees });
  });
}

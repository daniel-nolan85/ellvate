import { toggleJoin } from '@/src/backend/events';
import { getRequestUserId, jsonError, jsonOk } from '@/src/backend/http';

export async function POST(
  request: Request,
  params: Record<string, string>,
): Promise<Response> {
  const userId = await getRequestUserId(request);
  const result = toggleJoin(userId, params.id ?? '');

  if (!result) {
    return jsonError(404, 'event_not_found', 'Event not found.');
  }

  return jsonOk(result);
}

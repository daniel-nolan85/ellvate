import { getEventsView } from '@/src/backend/events';
import { getRequestUserId, jsonOk } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  return jsonOk(getEventsView(userId));
}

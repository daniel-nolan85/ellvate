import { getEventsView } from '@/src/backend/events';
import { createRequestContext, jsonOk } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk(await getEventsView(ctx));
}

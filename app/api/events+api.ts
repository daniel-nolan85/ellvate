import { createEvent, getEventsView } from '@/src/backend/events';
import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk(await getEventsView(ctx));
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  const body: unknown = await request.json().catch(() => null);
  const result = await createEvent(ctx, body);

  if (!result.ok) {
    return jsonError(400, result.code, result.message);
  }
  return jsonOk({ event: result.event }, { status: 201 });
}

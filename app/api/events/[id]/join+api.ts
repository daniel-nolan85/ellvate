import { toggleJoin } from '@/src/backend/events';
import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  const ctx = await createRequestContext(request);
  const result = await toggleJoin(ctx, id);

  if (!result) {
    return jsonError(404, 'event_not_found', 'Event not found.');
  }

  return jsonOk(result);
}

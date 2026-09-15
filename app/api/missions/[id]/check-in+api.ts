import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { checkIn } from '@/src/backend/missions';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    // A photo is entirely optional -- most check-ins send no body at all,
    // so a missing/unparseable one is just "no photo attached," not an error.
    const body: unknown = await request.json().catch(() => null);
    const result = await checkIn(ctx, id, body);

    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }

    return jsonOk(result.body);
  });
}

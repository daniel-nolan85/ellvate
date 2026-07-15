import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { checkIn } from '@/src/backend/missions';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const result = await checkIn(ctx, id);

    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }

    return jsonOk(result.body);
  });
}

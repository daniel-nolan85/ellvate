import { toggleSignature } from '@/src/backend/petitions';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const outcome = await toggleSignature(ctx, id);

    if (!outcome.ok) {
      return jsonError(
        outcome.code === 'petition_not_found' ? 404 : 409,
        outcome.code,
        outcome.message,
      );
    }
    return jsonOk(outcome.result);
  });
}

import { getPetition } from '@/src/backend/petitions';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const petition = await getPetition(ctx, id);
    if (!petition) {
      return jsonError(404, 'petition_not_found', 'Petition not found.');
    }
    return jsonOk({ petition });
  });
}

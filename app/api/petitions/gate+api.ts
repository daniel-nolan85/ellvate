import { getPetitionsGate } from '@/src/backend/petitions';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const gate = await getPetitionsGate(ctx);
    return jsonOk(gate);
  });
}

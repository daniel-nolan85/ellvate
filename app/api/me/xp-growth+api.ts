import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getXpGrowth } from '@/src/backend/xp';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const growth = await getXpGrowth(ctx);
    return jsonOk(growth);
  });
}

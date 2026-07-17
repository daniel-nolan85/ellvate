import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { reportPost } from '@/src/backend/reports';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const result = await reportPost(ctx, id);
    if (!result.ok) {
      return jsonError(404, result.code, result.message);
    }
    return jsonOk({ reported: result.reported });
  });
}

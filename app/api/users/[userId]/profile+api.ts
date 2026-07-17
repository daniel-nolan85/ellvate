import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { getPublicProfile } from '@/src/backend/profile';

export async function GET(
  request: Request,
  { userId }: Record<string, string>,
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const summary = await getPublicProfile(ctx, userId);
    if (!summary) {
      return jsonError(404, 'member_not_found', 'Member not found.');
    }
    return jsonOk(summary);
  });
}

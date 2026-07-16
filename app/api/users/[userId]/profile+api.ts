import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getPublicProfile } from '@/src/backend/profile';

export async function GET(
  request: Request,
  { userId }: Record<string, string>,
): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk(await getPublicProfile(ctx, userId)),
  );
}

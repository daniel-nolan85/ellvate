import { jsonOk, withRequestContext } from '@/src/backend/http';
import { toggleMute } from '@/src/backend/mutes';

export async function POST(
  request: Request,
  { userId }: Record<string, string>,
): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk(await toggleMute(ctx, userId)),
  );
}

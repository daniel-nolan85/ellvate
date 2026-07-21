import { listMyComments } from '@/src/backend/comments';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ comments: await listMyComments(ctx) }),
  );
}

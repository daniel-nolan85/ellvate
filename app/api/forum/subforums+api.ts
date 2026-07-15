import { listSubforums } from '@/src/backend/forum';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) =>
    jsonOk({ subforums: await listSubforums(ctx) }),
  );
}

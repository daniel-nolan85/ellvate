import { listSubforums } from '@/src/backend/forum';
import { createRequestContext, jsonOk } from '@/src/backend/http';

export async function GET(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk({ subforums: await listSubforums(ctx) });
}

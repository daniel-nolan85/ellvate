import { createRequestContext, jsonOk } from '@/src/backend/http';
import { getMissionsView } from '@/src/backend/missions';

export async function GET(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk(await getMissionsView(ctx));
}

import { createRequestContext, jsonError, jsonOk } from '@/src/backend/http';
import { createMission, getMissionsView } from '@/src/backend/missions';

export async function GET(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  return jsonOk(await getMissionsView(ctx));
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await createRequestContext(request);
  const body: unknown = await request.json().catch(() => null);
  const result = await createMission(ctx, body);

  if (!result.ok) {
    return jsonError(400, result.code, result.message);
  }
  return jsonOk({ mission: result.mission }, { status: 201 });
}

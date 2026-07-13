import { getRequestUserId, jsonOk } from '@/src/backend/http';
import { getMissionsView } from '@/src/backend/missions';

export async function GET(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  return jsonOk(getMissionsView(userId));
}

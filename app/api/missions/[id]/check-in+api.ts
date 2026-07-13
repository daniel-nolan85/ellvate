import { getRequestUserId, jsonError, jsonOk } from '@/src/backend/http';
import { checkIn } from '@/src/backend/missions';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  const userId = await getRequestUserId(request);
  const result = checkIn(userId, id);

  if (!result.ok) {
    return jsonError(result.status, result.code, result.message);
  }

  return jsonOk(result.body);
}

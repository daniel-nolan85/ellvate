import { toggleCheckInPhotoLike } from '@/src/backend/missions';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const result = await toggleCheckInPhotoLike(ctx, id);

    if (!result) {
      return jsonError(404, 'check_in_not_found', 'Check-in photo not found.');
    }
    return jsonOk(result);
  });
}

import { deleteAccount } from '@/src/backend/account';
import { jsonOk, withRequestContext } from '@/src/backend/http';

export async function DELETE(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    await deleteAccount(ctx);
    return jsonOk({ deleted: true });
  });
}

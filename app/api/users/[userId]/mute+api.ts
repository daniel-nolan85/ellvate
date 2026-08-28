import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { toggleMute } from '@/src/backend/mutes';

export async function POST(
  request: Request,
  { userId }: Record<string, string>,
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    // The UI never offers a "block yourself" affordance (every block button
    // is gated on author.id !== the viewer), but nothing stops this route
    // from being called directly with your own id -- and unlike an unknown
    // target id (rejected by user_mutes' FK to app_users), blocking yourself
    // would succeed and then silently filter your own content out of your
    // own feeds.
    if (userId === ctx.userId) {
      return jsonError(400, 'cannot_block_self', 'You can’t block yourself.');
    }
    return jsonOk(await toggleMute(ctx, userId));
  });
}

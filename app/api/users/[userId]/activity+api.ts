import { listMyComments } from '@/src/backend/comments';
import { getMyEventsView } from '@/src/backend/events';
import { getMyPosts } from '@/src/backend/forum';
import { jsonError, jsonOk, withRequestContext } from '@/src/backend/http';
import { getMyMissionsView } from '@/src/backend/missions';
import { getMemberActivitySharing } from '@/src/backend/profile';
import { getMyServiceListingsView } from '@/src/backend/services';

// A capped, non-paginated snapshot of another member's public activity —
// unlike /api/{forum/posts,events,missions,services}/mine, which page
// through the caller's own history for the (much more heavily used) Activity
// Hub. Read-only browsing of a neighbour's activity doesn't need that same
// infinite-scroll machinery, just a reasonable first page of each.
const MEMBER_ACTIVITY_LIMIT = 20;

export async function GET(
  request: Request,
  { userId }: { userId: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    // Aggregate figures (postsCount, eventsCreated, ...) shown on a member's
    // profile are always public — this route is the detailed content list,
    // which is opt-in via profile.activityVisible. Owners can always see
    // their own, regardless of that setting.
    if (ctx.userId !== userId) {
      const sharing = await getMemberActivitySharing(ctx, userId);
      if (sharing === 'not_found') {
        return jsonError(404, 'member_not_found', 'Member not found.');
      }
      if (sharing === 'private') {
        return jsonError(
          403,
          'activity_not_shared',
          "This member hasn't shared their activity.",
        );
      }
    }

    // Every one of these dispatch functions reads only ctx.userId to decide
    // whose content to return — the same trick getPublicProfile uses to read
    // a member's stats without impersonating them for writes.
    const memberCtx = { ...ctx, userId };

    const [postsPage, comments, eventsPage, missionsPage, servicesPage] =
      await Promise.all([
        getMyPosts(memberCtx, { limit: MEMBER_ACTIVITY_LIMIT }),
        listMyComments(memberCtx),
        getMyEventsView(memberCtx, { limit: MEMBER_ACTIVITY_LIMIT }),
        getMyMissionsView(memberCtx, { limit: MEMBER_ACTIVITY_LIMIT }),
        getMyServiceListingsView(memberCtx, { limit: MEMBER_ACTIVITY_LIMIT }),
      ]);

    return jsonOk({
      comments,
      events: eventsPage.events,
      missions: missionsPage.missions,
      posts: postsPage.posts,
      services: servicesPage.listings,
    });
  });
}

// Pure so the routing decision for each notification kind
// (post/event/mission/petition/business/digest) is regression-tested
// without rendering the screen or its data hooks.
export function resolveNotificationRoute(
  data: Readonly<Record<string, unknown>>,
):
  | `/notification/post/${string}`
  | `/notification/event/${string}`
  | `/notification/mission/${string}`
  | `/notification/petition/${string}`
  | `/notification/business/${string}`
  | `/digest`
  | `/digest?${string}`
  | null {
  const postId = data.postId;
  const eventId = data.eventId;
  const missionId = data.missionId;
  const petitionId = data.petitionId;
  const businessId = data.businessId;
  const weekStart = data.weekStart;
  // Each of these routes to a /notification/... duplicate (see
  // app/notification/post/[id].tsx and friends), not the plain /post/...
  // etc. used everywhere else -- so anything reached from Notifications
  // always presents as a modal, without changing those screens' other,
  // plain-push entry points.
  if (typeof postId === 'string') {
    return `/notification/post/${postId}`;
  }
  if (typeof eventId === 'string') {
    return `/notification/event/${eventId}`;
  }
  if (typeof missionId === 'string') {
    return `/notification/mission/${missionId}`;
  }
  // "Petition succeeded" / "The HOA board responded" notifications (see
  // migrations 0035/0036) carry a bare petitionId, same shape as the other
  // kinds -- this case was missing entirely, so tapping either fell through
  // to the null case below and silently did nothing.
  if (typeof petitionId === 'string') {
    return `/notification/petition/${petitionId}`;
  }
  // "Your listing is live" notification (see approveBusinessListingAction
  // in the admin app) carries a bare businessId, same shape as the other
  // kinds.
  if (typeof businessId === 'string') {
    return `/notification/business/${businessId}`;
  }
  if (typeof weekStart === 'string') {
    return `/digest?weekStart=${encodeURIComponent(weekStart)}`;
  }
  return null;
}

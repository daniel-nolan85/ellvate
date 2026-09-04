// Pure so the routing decision for each notification kind
// (post/event/mission/petition/digest) is regression-tested without
// rendering the screen or its data hooks.
export function resolveNotificationRoute(
  data: Readonly<Record<string, unknown>>,
):
  | `/post/${string}`
  | `/event/${string}`
  | `/mission/${string}`
  | `/petition/${string}`
  | `/digest`
  | `/digest?${string}`
  | null {
  const postId = data.postId;
  const eventId = data.eventId;
  const missionId = data.missionId;
  const petitionId = data.petitionId;
  const weekStart = data.weekStart;
  if (typeof postId === 'string') {
    return `/post/${postId}`;
  }
  if (typeof eventId === 'string') {
    return `/event/${eventId}`;
  }
  if (typeof missionId === 'string') {
    return `/mission/${missionId}`;
  }
  // "Petition succeeded" / "The HOA board responded" notifications (see
  // migrations 0035/0036) carry a bare petitionId, same shape as the other
  // kinds -- this case was missing entirely, so tapping either fell through
  // to the null case below and silently did nothing.
  if (typeof petitionId === 'string') {
    return `/petition/${petitionId}`;
  }
  if (typeof weekStart === 'string') {
    return `/digest?weekStart=${encodeURIComponent(weekStart)}`;
  }
  return null;
}

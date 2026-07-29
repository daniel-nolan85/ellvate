// Pure so the routing decision for each notification kind
// (post/event/mission/digest) is regression-tested without rendering the
// screen or its data hooks.
export function resolveNotificationRoute(
  data: Readonly<Record<string, unknown>>,
):
  | `/post/${string}`
  | `/event/${string}`
  | `/mission/${string}`
  | `/digest`
  | `/digest?${string}`
  | null {
  const postId = data.postId;
  const eventId = data.eventId;
  const missionId = data.missionId;
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
  if (typeof weekStart === 'string') {
    return `/digest?weekStart=${encodeURIComponent(weekStart)}`;
  }
  return null;
}

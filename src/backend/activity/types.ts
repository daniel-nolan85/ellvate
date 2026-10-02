// The true, unpaginated totals behind My Activity's stat tiles -- see
// activity-counts.ts's own WHY for why these can't just be the length of
// whatever page useMyPosts/useMyEventsView/etc. have fetched so far.
export interface MyActivityCounts {
  readonly postsCount: number;
  readonly eventsCreatedCount: number;
  // Includes a member's own event if they explicitly marked themselves
  // going to it, by request -- creating an event doesn't count toward this
  // on its own, only an explicit Join tap does.
  readonly eventsAttendingCount: number;
  // The deduped union of events created OR attended -- NOT eventsCreatedCount
  // + eventsAttendingCount, since a member can both create an event and
  // mark themselves going to it, which is still only ever one row in the
  // Events section's list. This is the true count of that list.
  readonly eventsCount: number;
  readonly missionsCreatedCount: number;
  readonly missionsCompletedCount: number;
  // The deduped union of missions created OR completed -- NOT
  // missionsCreatedCount + missionsCompletedCount, since a mission a member
  // created and later completed themselves counts toward both of those but
  // is still only ever one row in the Missions section's list. This is the
  // true count of that list.
  readonly missionsCount: number;
  readonly servicesCount: number;
  readonly petitionsCount: number;
}

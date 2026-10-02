// The true, unpaginated totals behind My Activity's stat tiles -- see
// activity-counts.ts's own WHY for why these can't just be the length of
// whatever page useMyPosts/useMyEventsView/etc. have fetched so far.
export interface MyActivityCounts {
  readonly postsCount: number;
  readonly eventsCreatedCount: number;
  readonly eventsAttendingCount: number;
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

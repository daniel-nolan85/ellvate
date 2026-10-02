// The true, unpaginated totals behind My Activity's stat tiles -- see
// activity-counts.ts's own WHY for why these can't just be the length of
// whatever page useMyPosts/useMyEventsView/etc. have fetched so far.
export interface MyActivityCounts {
  readonly postsCount: number;
  readonly eventsCreatedCount: number;
  readonly eventsAttendingCount: number;
  readonly missionsCreatedCount: number;
  readonly missionsCompletedCount: number;
  readonly servicesCount: number;
  readonly petitionsCount: number;
}

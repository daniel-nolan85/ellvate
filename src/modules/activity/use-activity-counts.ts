import { useQuery } from '@tanstack/react-query';

import { activityCountsKey } from '@/src/lib/activity-counts-key';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface MyActivityCounts {
  readonly postsCount: number;
  readonly eventsCreatedCount: number;
  // Includes a member's own event if they explicitly marked themselves
  // going to it -- creating an event doesn't count toward this on its own.
  readonly eventsAttendingCount: number;
  // The deduped union of events created OR attended -- see
  // src/backend/activity/types.ts's own WHY for why this isn't just
  // eventsCreatedCount + eventsAttendingCount.
  readonly eventsCount: number;
  readonly missionsCreatedCount: number;
  readonly missionsCompletedCount: number;
  // The deduped union of missions created OR completed -- see
  // src/backend/activity/types.ts's own WHY for why this isn't just
  // missionsCreatedCount + missionsCompletedCount.
  readonly missionsCount: number;
  readonly servicesCount: number;
  readonly petitionsCount: number;
}

// The real, unpaginated totals behind My Activity's stat tiles --
// ActivityStatPanel used to be fed `someItems.length` from each content
// type's own infinite-scroll query, which is only correct once every page
// has been fetched (each paginated at 20 items). A member with 23 events
// created saw "20" on first load, only updating to 23 once they'd scrolled
// far enough to trigger the next page. See app/api/activity/counts+api.ts
// and supabase/migrations/0077_my_activity_counts_rpc.sql for where the
// real total comes from.
export function useMyActivityCounts() {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<MyActivityCounts>({
        getAccessToken: session.getToken,
        path: '/api/activity/counts',
        signal,
      }),
    queryKey: activityCountsKey(session.userId),
  });
}

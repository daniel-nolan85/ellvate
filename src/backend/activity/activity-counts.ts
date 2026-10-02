import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';

import { getMyActivityCountsSupabase } from './activity-counts-supabase';
import type { MyActivityCounts } from './types';

// My Activity's stat tiles used to be computed client-side as the length of
// whatever page of useMyPosts/useMyEventsView/useMyMissionsView/etc. had
// been fetched so far (each paginated at 20 items) -- correct only once
// every page had loaded, so a member with e.g. 23 events created saw "20"
// until they scrolled far enough to trigger the next page. This gives the
// real, unpaginated total instead.
//
// eventsAttendingCount/missionsCompletedCount/petitionsCount each need the
// exact same semantics as activity-screen.tsx's own client-side filtering
// (self-authored events excluded from "attending", missions_completed read
// from the same counter the Leaderboard uses, petitions counted whether
// created or merely signed) -- see 0077_my_activity_counts_rpc.sql's own WHY
// for the Supabase side of this same reasoning.
function getMyActivityCountsMemory(userId: string): MyActivityCounts {
  const { events, missions, petitionSignatures, petitions, posts, serviceListings, users } =
    getState();
  const signedPetitionIds = new Set(
    petitionSignatures
      .filter((signature) => signature.userId === userId)
      .map((signature) => signature.petitionId),
  );
  const myPetitionIds = new Set([
    ...petitions.filter((petition) => petition.createdBy === userId).map((petition) => petition.id),
    ...signedPetitionIds,
  ]);
  return {
    eventsAttendingCount: events.filter(
      (event) => event.authorId !== userId && event.joinedBy.includes(userId),
    ).length,
    eventsCreatedCount: events.filter((event) => event.authorId === userId).length,
    missionsCompletedCount: users.find((user) => user.id === userId)?.missionsCompleted ?? 0,
    missionsCreatedCount: missions.filter((mission) => mission.authorId === userId).length,
    petitionsCount: myPetitionIds.size,
    postsCount: posts.filter((post) => post.authorId === userId).length,
    servicesCount: serviceListings.filter((listing) => listing.authorId === userId).length,
  };
}

export async function getMyActivityCounts(ctx: RequestContext): Promise<MyActivityCounts> {
  return ctx.supabase
    ? getMyActivityCountsSupabase(ctx.supabase)
    : getMyActivityCountsMemory(ctx.userId);
}

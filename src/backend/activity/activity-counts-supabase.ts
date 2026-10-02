import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { MyActivityCounts } from './types';

interface MyActivityCountsRow {
  readonly posts_count: number;
  readonly events_created: number;
  readonly events_attending: number;
  readonly missions_created: number;
  readonly missions_completed: number;
  readonly services_listed: number;
  readonly petitions_count: number;
}

// One round trip via the my_activity_counts() RPC (0077) -- see that
// migration's own WHY for why each of these needs different logic than a
// plain per-table count(*), and for why it's scoped to the caller rather
// than taking a member id the way the public-profile equivalent
// (member_activity_counts) does.
export async function getMyActivityCountsSupabase(
  supabase: SupabaseClient,
): Promise<MyActivityCounts> {
  const { data, error } = await supabase.rpc('my_activity_counts').single();
  throwIfSupabaseError(error, 'load my activity counts');
  const row = data as unknown as MyActivityCountsRow;
  return {
    eventsAttendingCount: row.events_attending,
    eventsCreatedCount: row.events_created,
    missionsCompletedCount: row.missions_completed,
    missionsCreatedCount: row.missions_created,
    petitionsCount: row.petitions_count,
    postsCount: row.posts_count,
    servicesCount: row.services_listed,
  };
}

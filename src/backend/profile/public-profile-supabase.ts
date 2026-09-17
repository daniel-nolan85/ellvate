import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { MemberActivityCounts, PublicMemberRow } from './public-profile';

const MEMBER_SELECT = 'id,name,avatar_url,role,interests,activity_visible';

interface MemberRow {
  readonly id: string;
  readonly name: string;
  readonly avatar_url: string | null;
  readonly role: PublicMemberRow['role'];
  readonly interests: readonly string[];
  readonly activity_visible: boolean;
}

// Read-only: app_users is publicly readable (see "read app_users" RLS policy),
// so this never writes — unlike ensureUser(), which only the row's own owner
// is allowed to insert/update under Clerk-scoped RLS.
export async function getMemberRowSupabase(
  supabase: SupabaseClient,
  memberUserId: string,
): Promise<PublicMemberRow | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select(MEMBER_SELECT)
    .eq('id', memberUserId)
    .maybeSingle();
  throwIfSupabaseError(error, 'load public profile');
  if (!data) {
    return null;
  }
  const row = data as unknown as MemberRow;
  return {
    activityVisible: row.activity_visible,
    avatarUrl: row.avatar_url,
    id: row.id,
    interests: row.interests,
    name: row.name,
    role: row.role,
  };
}

// Batch variant of getMemberRowSupabase for a caller that already has a set
// of member ids in hand (the blocked-users list) and only needs display
// fields, not the full profile row -- one query instead of one per id.
export async function getMemberDisplayRowsSupabase(
  supabase: SupabaseClient,
  memberUserIds: readonly string[],
): Promise<readonly { readonly id: string; readonly name: string; readonly avatarUrl: string | null }[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('id,name,avatar_url')
    .in('id', memberUserIds);
  throwIfSupabaseError(error, 'load member display rows');
  return (data ?? []).map((row) => ({
    avatarUrl: row.avatar_url as string | null,
    id: row.id as string,
    name: row.name as string,
  }));
}

interface MemberActivityCountsRow {
  readonly posts_count: number;
  readonly missions_created: number;
  readonly events_created: number;
  readonly events_attended: number;
  readonly services_listed: number;
  readonly petitions_started: number;
}

// One round trip via the member_activity_counts() RPC (0062), not 6 separate
// head-count queries -- getPublicProfile already fires several other
// subrequests of its own (the member row, and getMissionsView's own 4), and
// this member-profile-only path used to add 6 more, hitting the hosting
// platform's per-request subrequest cap -- see missions-supabase.ts's
// MISSION_SELECT comment for the exact "Too many subrequests by single
// Worker invocation" failure this mirrors.
export async function getMemberActivityCountsSupabase(
  supabase: SupabaseClient,
  memberUserId: string,
): Promise<MemberActivityCounts> {
  const { data, error } = await supabase
    .rpc('member_activity_counts', { member_id: memberUserId })
    .single();
  throwIfSupabaseError(error, 'count member activity');
  const row = data as unknown as MemberActivityCountsRow;
  return {
    eventsAttended: row.events_attended,
    eventsCreated: row.events_created,
    missionsCreated: row.missions_created,
    petitionsStarted: row.petitions_started,
    postsCount: row.posts_count,
    servicesListed: row.services_listed,
  };
}

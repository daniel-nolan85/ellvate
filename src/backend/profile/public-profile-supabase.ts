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

// Count-only (head) queries — cheaper than fetching full rows just to
// measure how many a member has, and mirrors the read-only, ownership-blind
// nature of getMemberRowSupabase above (app_users is publicly readable).
export async function getMemberActivityCountsSupabase(
  supabase: SupabaseClient,
  memberUserId: string,
): Promise<MemberActivityCounts> {
  const [
    postsRes,
    missionsRes,
    eventsCreatedRes,
    eventsAttendedRes,
    servicesListedRes,
  ] = await Promise.all([
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', memberUserId),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', memberUserId),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', memberUserId),
    supabase
      .from('event_joins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', memberUserId),
    supabase
      .from('service_listings')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', memberUserId),
  ]);
  throwIfSupabaseError(postsRes.error, 'count member posts');
  throwIfSupabaseError(missionsRes.error, 'count member missions created');
  throwIfSupabaseError(eventsCreatedRes.error, 'count member events created');
  throwIfSupabaseError(
    eventsAttendedRes.error,
    'count member events attended',
  );
  throwIfSupabaseError(
    servicesListedRes.error,
    'count member services listed',
  );
  return {
    eventsAttended: eventsAttendedRes.count ?? 0,
    eventsCreated: eventsCreatedRes.count ?? 0,
    missionsCreated: missionsRes.count ?? 0,
    postsCount: postsRes.count ?? 0,
    servicesListed: servicesListedRes.count ?? 0,
  };
}

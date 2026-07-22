import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { PublicMemberRow } from './public-profile';

const MEMBER_SELECT = 'id,name,avatar_url,role,interests';

interface MemberRow {
  readonly id: string;
  readonly name: string;
  readonly avatar_url: string | null;
  readonly role: PublicMemberRow['role'];
  readonly interests: readonly string[];
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
    avatarUrl: row.avatar_url,
    id: row.id,
    interests: row.interests,
    name: row.name,
    role: row.role,
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import { CHECK_INS_LIST_LIMIT, type CheckInEntry, type ReportCheckInResult } from './types';

const CHECK_IN_SELECT =
  'id,mission_id,user_id,stop_index,completed_at,photo_url,user:app_users!mission_check_ins_user_id_fkey(id,name,avatar_url,is_admin)';

interface CheckInRow {
  readonly id: string;
  readonly mission_id: string;
  readonly user_id: string;
  readonly stop_index: number;
  readonly completed_at: string;
  readonly photo_url: string | null;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

const toCheckInEntry = (row: CheckInRow): CheckInEntry => ({
  id: row.id,
  missionId: row.mission_id,
  user: {
    avatarUrl: row.user?.avatar_url ?? null,
    id: row.user_id,
    isAdmin: row.user?.is_admin ?? false,
    name: row.user?.name ?? 'Member',
  },
  stopIndex: row.stop_index,
  completedAt: row.completed_at,
  photoUrl: row.photo_url,
});

const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert(
      { id: userId, name: 'Member' },
      { ignoreDuplicates: true, onConflict: 'id' },
    );
  throwIfSupabaseError(error, 'ensure mission check-in user');
};

export async function listMissionCheckInsSupabase(
  supabase: SupabaseClient,
  missionId: string,
): Promise<readonly CheckInEntry[]> {
  // Fetch the most recent N (descending), then reverse back to oldest-first
  // for display — capping the *newest* window is what actually protects
  // against unbounded growth; capping an ascending query would instead keep
  // returning the same oldest N forever as more check-ins pile up.
  const { data, error } = await supabase
    .from('mission_check_ins')
    .select(CHECK_IN_SELECT)
    .eq('mission_id', missionId)
    .order('completed_at', { ascending: false })
    .limit(CHECK_INS_LIST_LIMIT);
  throwIfSupabaseError(error, 'load mission check-ins');
  return (data as unknown as CheckInRow[]).reverse().map(toCheckInEntry);
}

export async function reportCheckInSupabase(
  supabase: SupabaseClient,
  userId: string,
  checkInId: string,
): Promise<ReportCheckInResult> {
  const { data: checkIn, error: checkInError } = await supabase
    .from('mission_check_ins')
    .select('id')
    .eq('id', checkInId)
    .maybeSingle();
  throwIfSupabaseError(checkInError, 'load reported mission check-in');
  if (!checkIn) {
    return {
      code: 'check_in_not_found',
      message: 'Check-in not found.',
      ok: false,
    };
  }

  await ensureUser(supabase, userId);
  // Idempotent: a unique (check_in_id, reporter_id) constraint on
  // mission_check_in_reports means a repeat report from the same user is a
  // silent no-op, not an error.
  const { error } = await supabase
    .from('mission_check_in_reports')
    .upsert(
      { check_in_id: checkInId, reporter_id: userId },
      { ignoreDuplicates: true, onConflict: 'check_in_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report mission check-in');
  return { ok: true, reported: true };
}

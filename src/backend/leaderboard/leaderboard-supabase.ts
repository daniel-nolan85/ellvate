import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { LeaderboardEntry, LeaderboardResult } from './types';

const LEADERBOARD_SELECT =
  'id,name,avatar_url,xp,missions_completed,previous_rank';

interface LeaderRow {
  readonly id: string;
  readonly name: string;
  readonly avatar_url: string | null;
  readonly xp: number;
  readonly missions_completed: number;
  readonly previous_rank: number | null;
}

const toEntry = (
  row: LeaderRow,
  rank: number,
  requestingUserId: string,
): LeaderboardEntry => ({
  rank,
  user: { avatarUrl: row.avatar_url, id: row.id, name: row.name },
  isMe: row.id === requestingUserId,
  missionsCompleted: row.missions_completed,
  xp: row.xp,
  rankDelta: row.previous_rank === null ? 0 : row.previous_rank - rank,
});

export async function getLeaderboardSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<LeaderboardResult> {
  const { data, error } = await supabase
    .from('app_users')
    .select(LEADERBOARD_SELECT)
    .eq('on_leaderboard', true)
    .order('missions_completed', { ascending: false })
    .order('xp', { ascending: false });
  throwIfSupabaseError(error, 'load leaderboard');
  const rows = (data ?? []) as unknown as LeaderRow[];
  return {
    leaders: rows.map((row, index) => toEntry(row, index + 1, userId)),
  };
}

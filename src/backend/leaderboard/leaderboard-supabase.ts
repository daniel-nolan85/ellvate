import type { SupabaseClient } from '@supabase/supabase-js';

import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { LeaderboardEntry, LeaderboardPage, LeaderboardResult } from './types';
import {
  addToTally,
  DAY_MS,
  RANGE_DAYS,
  rankTally,
  type LeaderboardRange,
  type WindowedTally,
} from './windowed-tally';

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

async function getAllTimeLeaderboardSupabase(
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

interface ProgressRow {
  readonly user_id: string;
  readonly mission_id: string;
  readonly completed_at: string | null;
}

interface MissionXpRow {
  readonly id: string;
  readonly xp: number;
}

interface MemberRow {
  readonly id: string;
  readonly name: string;
  readonly avatar_url: string | null;
}

// Mirrors the memory backend's tallyCompletions: no new tracking beyond the
// completed_at column mission check-in already writes (see 0014_mission_completed_at.sql).
async function getWindowedLeaderboardSupabase(
  supabase: SupabaseClient,
  userId: string,
  range: Exclude<LeaderboardRange, 'all'>,
): Promise<LeaderboardResult> {
  const days = RANGE_DAYS[range];
  const now = Date.now();
  const currentStartIso = new Date(now - days * DAY_MS).toISOString();
  const previousStartIso = new Date(now - 2 * days * DAY_MS).toISOString();

  const { data: progressData, error: progressError } = await supabase
    .from('mission_progress')
    .select('user_id,mission_id,completed_at')
    .eq('status', 'done')
    .gte('completed_at', previousStartIso);
  throwIfSupabaseError(progressError, 'load windowed mission completions');
  const progressRows = (progressData ?? []) as unknown as ProgressRow[];
  if (progressRows.length === 0) {
    return { leaders: [] };
  }

  const missionIds = [...new Set(progressRows.map((row) => row.mission_id))];
  const { data: missionData, error: missionError } = await supabase
    .from('missions')
    .select('id,xp')
    .in('id', missionIds);
  throwIfSupabaseError(missionError, 'load mission xp values');
  const xpByMissionId = new Map(
    ((missionData ?? []) as unknown as MissionXpRow[]).map((mission) => [
      mission.id,
      mission.xp,
    ]),
  );

  const currentTally = new Map<string, WindowedTally>();
  const previousTally = new Map<string, WindowedTally>();
  for (const row of progressRows) {
    if (!row.completed_at) {
      continue;
    }
    const xp = xpByMissionId.get(row.mission_id) ?? 0;
    const bucket =
      row.completed_at >= currentStartIso ? currentTally : previousTally;
    addToTally(bucket, row.user_id, xp);
  }

  const memberIds = [...currentTally.keys()];
  const { data: memberData, error: memberError } = await supabase
    .from('app_users')
    .select('id,name,avatar_url')
    .in('id', memberIds);
  throwIfSupabaseError(memberError, 'load leaderboard members');
  const membersById = new Map(
    ((memberData ?? []) as unknown as MemberRow[]).map((member) => [
      member.id,
      member,
    ]),
  );

  const previousRanks = new Map(
    rankTally(previousTally).map(({ rank, userId: id }) => [id, rank]),
  );

  return {
    leaders: rankTally(currentTally).map(({ rank, userId: id }) => {
      const tally = currentTally.get(id);
      const member = membersById.get(id);
      const previousRank = previousRanks.get(id);
      return {
        rank,
        user: {
          avatarUrl: member?.avatar_url ?? null,
          id,
          name: member?.name ?? 'Former member',
        },
        isMe: id === userId,
        missionsCompleted: tally?.missionsCompleted ?? 0,
        xp: tally?.xp ?? 0,
        rankDelta: previousRank === undefined ? 0 : previousRank - rank,
      };
    }),
  };
}

export async function getLeaderboardSupabase(
  supabase: SupabaseClient,
  userId: string,
  range: LeaderboardRange,
): Promise<LeaderboardResult> {
  return range === 'all'
    ? getAllTimeLeaderboardSupabase(supabase, userId)
    : getWindowedLeaderboardSupabase(supabase, userId, range);
}

// The paginated counterpart to getLeaderboardSupabase, mirroring the
// fetch-then-paginate-in-application-code precedent used across this
// codebase's Supabase backends. Rank must be computed over the FULL ranked
// set before slicing, so this fetches the full leaderboard and slices --
// the sortKey inverts rank since paginateInMemory always sorts descending.
const MAX_LEADERBOARD_RANK = 1_000_000;

export async function getLeaderboardPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  range: LeaderboardRange,
  limit: number,
  cursor: string | null,
): Promise<LeaderboardPage> {
  const full = await getLeaderboardSupabase(supabase, userId, range);
  const wrapped = full.leaders.map((entry) => ({
    entry,
    id: entry.user.id,
    sortKey: String(MAX_LEADERBOARD_RANK - entry.rank).padStart(7, '0'),
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    leaders: page.items.map((item) => item.entry),
    nextCursor: page.nextCursor,
  };
}

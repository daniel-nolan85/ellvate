import type { SupabaseClient } from '@supabase/supabase-js';

import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type {
  LeaderboardEntry,
  LeaderboardPage,
  LeaderboardResult,
} from './types';
import {
  DAY_MS,
  RANGE_DAYS,
  rankTally,
  type LeaderboardRange,
  type WindowedTally,
} from './windowed-tally';

const LEADERBOARD_SELECT =
  'id,name,avatar_url,xp,missions_completed,previous_rank,created_at';

interface LeaderRow {
  readonly id: string;
  readonly name: string;
  readonly avatar_url: string | null;
  readonly xp: number;
  readonly missions_completed: number;
  readonly previous_rank: number | null;
  readonly created_at: string;
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
    .order('xp', { ascending: false })
    .order('missions_completed', { ascending: false })
    // Final tiebreaker once both of the above match too (e.g. a brand-new
    // community where several members share the same onboarding-bonus-only
    // total) -- earliest-joined first, matching the windowed views' own
    // createdAt tiebreak below, so a tied member ranks the same on All time
    // as on This week/This month instead of each view falling back to its
    // own unordered leftover order.
    .order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'load leaderboard');
  const rows = (data ?? []) as unknown as LeaderRow[];
  return {
    leaders: rows.map((row, index) => toEntry(row, index + 1, userId)),
  };
}

interface WindowedTallyRow {
  readonly user_id: string;
  readonly current_xp: number;
  readonly current_missions_completed: number;
  readonly previous_xp: number;
  readonly previous_missions_completed: number;
}

interface MemberRow {
  readonly id: string;
  readonly name: string;
  readonly avatar_url: string | null;
  readonly created_at: string;
}

// Tallies every XP-earning ledger entry (posting, creating an event/
// mission/service/business listing, completing a mission, the onboarding
// bonus -- every reason grant_xp_and_log ever logs) within the window, via
// the windowed_xp_tally() RPC (0081) -- xp_ledger's own RLS only allows a
// user to read their own rows, so a direct cross-user query here would
// silently return almost nothing; see that migration's own WHY. Previously
// only tallied mission_progress completions, which meant a member who
// earned plenty of XP from creating content but hadn't completed a mission
// that week showed up nowhere, even though the all-time leaderboard
// (reading app_users.xp, which already includes every reason) ranks them
// normally.
async function getWindowedLeaderboardSupabase(
  supabase: SupabaseClient,
  userId: string,
  range: Exclude<LeaderboardRange, 'all'>,
): Promise<LeaderboardResult> {
  const days = RANGE_DAYS[range];
  const now = Date.now();
  const currentStartIso = new Date(now - days * DAY_MS).toISOString();
  const previousStartIso = new Date(now - 2 * days * DAY_MS).toISOString();

  const { data: tallyData, error: tallyError } = await supabase.rpc(
    'windowed_xp_tally',
    {
      p_current_start: currentStartIso,
      p_previous_start: previousStartIso,
    },
  );
  throwIfSupabaseError(tallyError, 'load windowed xp tally');

  // Same exclusion the all-time leaderboard already applies via its own
  // .eq('on_leaderboard', true) above -- without this, an excluded account
  // (e.g. the app's own admin) would still tally and rank in the week/month
  // views even though they never appear in the all-time one.
  const { data: excludedData, error: excludedError } = await supabase
    .from('app_users')
    .select('id')
    .eq('on_leaderboard', false);
  throwIfSupabaseError(excludedError, 'load leaderboard-excluded members');
  const excludedIds = new Set(
    ((excludedData ?? []) as unknown as { readonly id: string }[]).map(
      (row) => row.id,
    ),
  );

  const tallyRows = ((tallyData ?? []) as unknown as WindowedTallyRow[]).filter(
    (row) => !excludedIds.has(row.user_id),
  );
  if (tallyRows.length === 0) {
    return { leaders: [] };
  }

  const currentTally = new Map<string, WindowedTally>(
    tallyRows
      .filter((row) => row.current_xp > 0 || row.current_missions_completed > 0)
      .map((row) => [
        row.user_id,
        {
          missionsCompleted: row.current_missions_completed,
          xp: row.current_xp,
        },
      ]),
  );
  const previousTally = new Map<string, WindowedTally>(
    tallyRows
      .filter(
        (row) => row.previous_xp > 0 || row.previous_missions_completed > 0,
      )
      .map((row) => [
        row.user_id,
        {
          missionsCompleted: row.previous_missions_completed,
          xp: row.previous_xp,
        },
      ]),
  );

  // Union of both windows' ids, not just the current one -- previousTally
  // can rank members currentTally never heard of (active last window, quiet
  // this one), and createdAtMsById below needs to cover both sides for the
  // tiebreak to actually apply to a previous-window tie too, not just the
  // current one.
  const memberIds = [
    ...new Set([...currentTally.keys(), ...previousTally.keys()]),
  ];
  const { data: memberData, error: memberError } = await supabase
    .from('app_users')
    .select('id,name,avatar_url,created_at')
    .in('id', memberIds);
  throwIfSupabaseError(memberError, 'load leaderboard members');
  const membersById = new Map(
    ((memberData ?? []) as unknown as MemberRow[]).map((member) => [
      member.id,
      member,
    ]),
  );
  // Same createdAt tiebreak the all-time view applies via its own
  // .order('created_at') -- see rankTally's own WHY for why this needs to
  // be passed explicitly rather than baked into WindowedTally itself.
  const createdAtMsById = new Map(
    [...membersById.entries()].map(([id, member]) => [
      id,
      Date.parse(member.created_at),
    ]),
  );

  const previousRanks = new Map(
    rankTally(previousTally, createdAtMsById).map(({ rank, userId: id }) => [
      id,
      rank,
    ]),
  );

  return {
    leaders: rankTally(currentTally, createdAtMsById).map(
      ({ rank, userId: id }) => {
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
      },
    ),
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

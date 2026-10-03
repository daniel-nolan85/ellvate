import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import type { StoredUser, StoredXpLedgerEntry } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  getLeaderboardPageSupabase,
  getLeaderboardSupabase,
} from './leaderboard-supabase';
import type {
  LeaderboardEntry,
  LeaderboardPage,
  LeaderboardResult,
} from './types';
import {
  addToTally,
  DAY_MS,
  RANGE_DAYS,
  rankTally,
  type LeaderboardRange,
  type WindowedTally,
} from './windowed-tally';

export const DEFAULT_LEADERBOARD_PAGE_SIZE = 20;
export const MAX_LEADERBOARD_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

// Ranked by XP first -- the headline number -- with missionsCompleted only
// breaking ties between equal XP totals, not driving rank on its own (a
// member with more XP always outranks one with fewer, regardless of either
// one's mission count). createdAt (earliest-joined-first) is the final
// tiebreaker once both of those match too -- same field, same direction, as
// rankTally's own tieBreakAscendingMs below, so a tied member lands in the
// same relative order on This week/This month as they do on All time
// instead of each view falling back to its own arbitrary leftover order.
const byXpThenMissions = (a: StoredUser, b: StoredUser): number =>
  b.xp - a.xp ||
  b.missionsCompleted - a.missionsCompleted ||
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

const toEntry = (
  user: StoredUser,
  rank: number,
  requestingUserId: string,
): LeaderboardEntry => ({
  rank,
  user: { avatarUrl: user.avatarUrl, id: user.id, name: user.name },
  isMe: user.id === requestingUserId,
  missionsCompleted: user.missionsCompleted,
  xp: user.xp,
  rankDelta: user.previousRank === null ? 0 : user.previousRank - rank,
});

function getAllTimeLeaderboardMemory(userId: string): LeaderboardResult {
  const ranked = getState()
    .users.filter((user) => user.missionsCompleted > 0 && user.onLeaderboard)
    .sort(byXpThenMissions);

  return {
    leaders: ranked.map((user, index) => toEntry(user, index + 1, userId)),
  };
}

// Tallies every XP-earning ledger entry (posting, creating an event/
// mission/service/business listing, completing a mission, the onboarding
// bonus -- every reason grantXp/recordXpLedgerEntry ever logs) whose
// createdAt falls within [windowStartMs, windowEndMs). xp_ledger is already
// the authoritative, timestamped record of every point ever awarded (see
// grant.ts), so week/month leaderboards need no separate tracking of their
// own -- they're just this same ledger, windowed.
function tallyLedgerEntries(
  xpLedger: readonly StoredXpLedgerEntry[],
  windowStartMs: number,
  windowEndMs: number,
  excludedUserIds: ReadonlySet<string>,
): Map<string, WindowedTally> {
  const tally = new Map<string, WindowedTally>();
  for (const entry of xpLedger) {
    if (excludedUserIds.has(entry.userId)) {
      continue;
    }
    const createdMs = Date.parse(entry.createdAt);
    if (createdMs < windowStartMs || createdMs >= windowEndMs) {
      continue;
    }
    addToTally(
      tally,
      entry.userId,
      entry.amount,
      entry.reason === 'mission_completed',
    );
  }
  return tally;
}

function getWindowedLeaderboardMemory(
  userId: string,
  range: Exclude<LeaderboardRange, 'all'>,
): LeaderboardResult {
  const { users, xpLedger } = getState();
  const usersById = new Map(users.map((user) => [user.id, user]));
  // Same exclusion the all-time leaderboard applies via onLeaderboard --
  // without it, an excluded account's windowed completions would still tally
  // and rank here even though they never appear in the all-time view.
  const excludedUserIds = new Set(
    users.filter((user) => !user.onLeaderboard).map((user) => user.id),
  );

  const days = RANGE_DAYS[range];
  const now = Date.now();
  const currentStart = now - days * DAY_MS;
  const previousStart = now - 2 * days * DAY_MS;

  const currentTally = tallyLedgerEntries(
    xpLedger,
    currentStart,
    now,
    excludedUserIds,
  );
  const previousTally = tallyLedgerEntries(
    xpLedger,
    previousStart,
    currentStart,
    excludedUserIds,
  );
  // Same createdAt tiebreak byXpThenMissions uses for the all-time view --
  // see rankTally's own WHY for why this needs to be passed explicitly
  // rather than baked into WindowedTally itself.
  const createdAtMsById = new Map(
    users.map((user) => [user.id, Date.parse(user.createdAt)]),
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
        const user = usersById.get(id);
        const previousRank = previousRanks.get(id);
        return {
          rank,
          user: {
            avatarUrl: user?.avatarUrl ?? null,
            id,
            name: user?.name ?? 'Former member',
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

function getLeaderboardMemory(
  userId: string,
  range: LeaderboardRange,
): LeaderboardResult {
  return range === 'all'
    ? getAllTimeLeaderboardMemory(userId)
    : getWindowedLeaderboardMemory(userId, range);
}

// The paginated counterpart to getLeaderboardMemory/Supabase. Rank must be
// computed over the FULL ranked set before slicing (rank is a global
// position, not a per-page one) -- both memory functions above already
// return leaders in ascending-rank order, so this just wraps that full
// result with the standard cursor slice, inverting rank into a sortKey since
// paginateInMemory always sorts descending.
const MAX_LEADERBOARD_RANK = 1_000_000;

function paginateLeaders(
  leaders: readonly LeaderboardEntry[],
  limit: number,
  cursor: string | null,
): LeaderboardPage {
  const wrapped = leaders.map((entry) => ({
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

function getLeaderboardPageMemory(
  userId: string,
  range: LeaderboardRange,
  limit: number,
  cursor: string | null,
): LeaderboardPage {
  return paginateLeaders(
    getLeaderboardMemory(userId, range).leaders,
    limit,
    cursor,
  );
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function getLeaderboard(
  ctx: RequestContext,
  range: LeaderboardRange = 'all',
): Promise<LeaderboardResult> {
  return ctx.supabase
    ? getLeaderboardSupabase(ctx.supabase, ctx.userId, range)
    : getLeaderboardMemory(ctx.userId, range);
}

// The paginated, public-facing counterpart to getLeaderboard.
export async function getLeaderboardPage(
  ctx: RequestContext,
  range: LeaderboardRange = 'all',
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<LeaderboardPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_LEADERBOARD_PAGE_SIZE),
    MAX_LEADERBOARD_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? getLeaderboardPageSupabase(ctx.supabase, ctx.userId, range, limit, cursor)
    : getLeaderboardPageMemory(ctx.userId, range, limit, cursor);
}

import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import type { StoredMission, StoredUser } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import { MISSION_COMPLETION_XP } from '../missions/user-progress';
import {
  getLeaderboardPageSupabase,
  getLeaderboardSupabase,
} from './leaderboard-supabase';
import type { LeaderboardEntry, LeaderboardPage, LeaderboardResult } from './types';
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

const byMissionsThenXp = (a: StoredUser, b: StoredUser): number =>
  b.missionsCompleted - a.missionsCompleted || b.xp - a.xp;

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
    .users.filter((user) => user.missionsCompleted > 0)
    .sort(byMissionsThenXp);

  return {
    leaders: ranked.map((user, index) => toEntry(user, index + 1, userId)),
  };
}

// Tallies every mission completion whose completedAt falls within
// [windowStartMs, windowEndMs) — the same completedAt timestamp the weekly
// digest already relies on (see MissionUserProgress) — so week/month
// leaderboards need no new tracking beyond what mission check-in already
// records.
function tallyCompletions(
  missions: readonly StoredMission[],
  windowStartMs: number,
  windowEndMs: number,
): Map<string, WindowedTally> {
  const tally = new Map<string, WindowedTally>();
  for (const mission of missions) {
    for (const [userId, progress] of Object.entries(mission.progressByUser)) {
      if (progress.status !== 'done' || progress.completedAt === null) {
        continue;
      }
      const completedMs = Date.parse(progress.completedAt);
      if (completedMs < windowStartMs || completedMs >= windowEndMs) {
        continue;
      }
      addToTally(tally, userId, MISSION_COMPLETION_XP);
    }
  }
  return tally;
}

function getWindowedLeaderboardMemory(
  userId: string,
  range: Exclude<LeaderboardRange, 'all'>,
): LeaderboardResult {
  const { missions, users } = getState();
  const usersById = new Map(users.map((user) => [user.id, user]));

  const days = RANGE_DAYS[range];
  const now = Date.now();
  const currentStart = now - days * DAY_MS;
  const previousStart = now - 2 * days * DAY_MS;

  const currentTally = tallyCompletions(missions, currentStart, now);
  const previousTally = tallyCompletions(missions, previousStart, currentStart);
  const previousRanks = new Map(
    rankTally(previousTally).map(({ rank, userId: id }) => [id, rank]),
  );

  return {
    leaders: rankTally(currentTally).map(({ rank, userId: id }) => {
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
    }),
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
  return paginateLeaders(getLeaderboardMemory(userId, range).leaders, limit, cursor);
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

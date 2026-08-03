import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import type { StoredMission, StoredUser } from '@/src/backend/store';

import { getLeaderboardSupabase } from './leaderboard-supabase';
import type { LeaderboardEntry, LeaderboardResult } from './types';
import {
  addToTally,
  DAY_MS,
  RANGE_DAYS,
  rankTally,
  type LeaderboardRange,
  type WindowedTally,
} from './windowed-tally';

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
      addToTally(tally, userId, mission.xp);
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

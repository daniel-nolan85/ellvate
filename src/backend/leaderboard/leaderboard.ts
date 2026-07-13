import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import type { StoredUser } from '@/src/backend/store';

import { getLeaderboardSupabase } from './leaderboard-supabase';
import type { LeaderboardEntry, LeaderboardResult } from './types';

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
  user: { id: user.id, name: user.name },
  isMe: user.id === requestingUserId,
  missionsCompleted: user.missionsCompleted,
  xp: user.xp,
  rankDelta: user.previousRank === null ? 0 : user.previousRank - rank,
});

function getLeaderboardMemory(userId: string): LeaderboardResult {
  const ranked = getState()
    .users.filter((user) => user.missionsCompleted > 0)
    .sort(byMissionsThenXp);

  return {
    leaders: ranked.map((user, index) => toEntry(user, index + 1, userId)),
  };
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function getLeaderboard(
  ctx: RequestContext,
): Promise<LeaderboardResult> {
  return ctx.supabase
    ? getLeaderboardSupabase(ctx.supabase, ctx.userId)
    : getLeaderboardMemory(ctx.userId);
}

// Shared by both the memory and Supabase leaderboard backends: turns a raw
// per-user tally of missions completed within some time window into ranked
// entries, sorted the same way as the all-time leaderboard (most missions
// completed, then most XP).
export type LeaderboardRange = 'week' | 'month' | 'all';

export const DAY_MS = 24 * 60 * 60 * 1000;

// Rolling windows (last N days from now), not calendar weeks/months — avoids
// timezone and month-length edge cases, and needs no scheduled reset job.
export const RANGE_DAYS: Readonly<Record<Exclude<LeaderboardRange, 'all'>, number>> = {
  week: 7,
  month: 30,
};

export interface WindowedTally {
  readonly missionsCompleted: number;
  readonly xp: number;
}

export function addToTally(
  tally: Map<string, WindowedTally>,
  userId: string,
  xp: number,
): void {
  const current = tally.get(userId) ?? { missionsCompleted: 0, xp: 0 };
  tally.set(userId, {
    missionsCompleted: current.missionsCompleted + 1,
    xp: current.xp + xp,
  });
}

export function rankTally(
  tally: ReadonlyMap<string, WindowedTally>,
): readonly { readonly userId: string; readonly rank: number }[] {
  return [...tally.entries()]
    .sort(
      ([, a], [, b]) =>
        b.missionsCompleted - a.missionsCompleted || b.xp - a.xp,
    )
    .map(([userId], index) => ({ rank: index + 1, userId }));
}

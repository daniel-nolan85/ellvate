// Shared by both the memory and Supabase leaderboard backends: turns a raw
// per-user tally of XP earned (from every XP-earning action, not just
// mission completions -- see addToTally's own WHY) within some time window
// into ranked entries, sorted the same way as the all-time leaderboard
// (most XP, then most missions completed as the tiebreaker).
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

// isMissionCompletion decides whether this specific XP-earning event also
// bumps the displayed missionsCompleted count -- xp itself is added
// unconditionally regardless of reason (posting, creating an event/mission/
// service/business listing, completing a mission, and the onboarding bonus
// all grant XP; only a mission completion should count toward
// missionsCompleted). Without this distinction the windowed (week/month)
// leaderboards only ever tallied mission completions -- a member who earned
// plenty of XP from creating content but hadn't completed a mission that
// week showed up nowhere, even though the all-time leaderboard (reading
// app_users.xp, which already includes every reason) ranks them normally.
export function addToTally(
  tally: Map<string, WindowedTally>,
  userId: string,
  xp: number,
  isMissionCompletion: boolean,
): void {
  const current = tally.get(userId) ?? { missionsCompleted: 0, xp: 0 };
  tally.set(userId, {
    missionsCompleted: current.missionsCompleted + (isMissionCompletion ? 1 : 0),
    xp: current.xp + xp,
  });
}

export function rankTally(
  tally: ReadonlyMap<string, WindowedTally>,
): readonly { readonly userId: string; readonly rank: number }[] {
  return [...tally.entries()]
    .sort(
      ([, a], [, b]) =>
        b.xp - a.xp || b.missionsCompleted - a.missionsCompleted,
    )
    .map(([userId], index) => ({ rank: index + 1, userId }));
}

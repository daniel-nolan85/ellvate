import { computeProgress, titleForLevel } from '@/src/backend/progress';
import type { StoredUser } from '@/src/backend/store';

import type { UserProgress } from './types';

// The rank a level-1 user starts at -- kept as a named constant since it's
// also the fallback used when there's no user to compute a real level for
// (e.g. an unknown member). Derived from the rank table itself rather than
// duplicated, so the two can never drift apart.
export const DEFAULT_PROGRESS_TITLE = titleForLevel(1);

interface ProgressStats {
  readonly xp: number;
  readonly missionsCompleted: number;
}

export function buildProgress({
  missionsCompleted,
  xp,
}: ProgressStats): UserProgress {
  const { level, xpForNextLevel, xpIntoLevel, xpToNextLevel } =
    computeProgress(xp);

  return {
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    xpToNextLevel,
    missionsCompleted,
    title: titleForLevel(level),
  };
}

export function buildUserProgress(user: StoredUser | undefined): UserProgress {
  return buildProgress({
    xp: user?.xp ?? 0,
    missionsCompleted: user?.missionsCompleted ?? 0,
  });
}

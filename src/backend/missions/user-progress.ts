import { computeProgress } from '@/src/backend/progress';
import type { StoredUser } from '@/src/backend/store';

import type { UserProgress } from './types';

export const DEFAULT_PROGRESS_TITLE = 'LAKE EXPLORER';

export function buildUserProgress(user: StoredUser | undefined): UserProgress {
  const xp = user?.xp ?? 0;
  const { level, xpForNextLevel, xpIntoLevel, xpToNextLevel } =
    computeProgress(xp);

  return {
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    xpToNextLevel,
    streakDays: user?.streakDays ?? 0,
    missionsCompleted: user?.missionsCompleted ?? 0,
    title: user?.title ?? DEFAULT_PROGRESS_TITLE,
  };
}

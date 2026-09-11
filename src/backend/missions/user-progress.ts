import { computeProgress } from '@/src/backend/progress';
import type { StoredUser } from '@/src/backend/store';

import type { UserProgress } from './types';

export const DEFAULT_PROGRESS_TITLE = 'LAKE EXPLORER';

// Flat, not per-mission -- the completion check (a photo scanned for a
// face) can't tell a mission actually done from one faked, so a longer or
// "harder" mission paying out more than a short one just makes the exploit
// worth more the harder it looks. Every completed mission is worth the same.
export const MISSION_COMPLETION_XP = 50;

interface ProgressStats {
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly title: string;
}

export function buildProgress({
  missionsCompleted,
  streakDays,
  title,
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
    streakDays,
    missionsCompleted,
    title,
  };
}

export function buildUserProgress(user: StoredUser | undefined): UserProgress {
  return buildProgress({
    xp: user?.xp ?? 0,
    streakDays: user?.streakDays ?? 0,
    missionsCompleted: user?.missionsCompleted ?? 0,
    title: user?.title ?? DEFAULT_PROGRESS_TITLE,
  });
}

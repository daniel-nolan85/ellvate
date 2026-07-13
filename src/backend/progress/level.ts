export const LEVEL_XP_SPAN = 300;

export interface ProgressBreakdown {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
}

export function computeProgress(xp: number): ProgressBreakdown {
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const level = Math.floor(safeXp / LEVEL_XP_SPAN) + 1;
  const xpIntoLevel = safeXp % LEVEL_XP_SPAN;

  return {
    level,
    xpIntoLevel,
    xpForNextLevel: LEVEL_XP_SPAN,
    xpToNextLevel: LEVEL_XP_SPAN - xpIntoLevel,
  };
}

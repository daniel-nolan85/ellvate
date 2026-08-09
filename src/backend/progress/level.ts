export const LEVEL_XP_BASE = 300;
export const LEVEL_XP_GROWTH = 1.05;
export const LEVEL_XP_CAP = 900;

export interface ProgressBreakdown {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
}

// XP required to complete the given level (1-indexed). Grows 5% per level
// from a 300 XP base so each level takes a little longer than the last,
// capped at 900 XP so the climb settles into a steady rate instead of
// spiralling toward an eventually-unreachable amount.
function xpSpanForLevel(level: number): number {
  return Math.min(LEVEL_XP_CAP, Math.round(LEVEL_XP_BASE * LEVEL_XP_GROWTH ** (level - 1)));
}

export function computeProgress(xp: number): ProgressBreakdown {
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;

  let level = 1;
  let remaining = safeXp;

  // Phase 1: climb level by level while the span is still ramping up --
  // bounded, since the span reaches the cap within a few dozen levels.
  let span = xpSpanForLevel(level);
  while (span < LEVEL_XP_CAP && remaining >= span) {
    remaining -= span;
    level += 1;
    span = xpSpanForLevel(level);
  }

  // Phase 2: once the span has capped out, every remaining level costs
  // exactly LEVEL_XP_CAP, so the rest of the climb is a flat division
  // instead of looping level by level -- matters for very large XP totals.
  if (span === LEVEL_XP_CAP && remaining >= span) {
    const levelsAtCap = Math.floor(remaining / span);
    level += levelsAtCap;
    remaining -= levelsAtCap * span;
  }

  return {
    level,
    xpIntoLevel: remaining,
    xpForNextLevel: span,
    xpToNextLevel: span - remaining,
  };
}

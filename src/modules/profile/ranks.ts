// Mirrors src/backend/progress/rank.ts -- frontend modules never import
// from src/backend (see use-points-history.ts's own PointsHistoryReason for
// the same precedent), so the table is kept in sync here by hand instead.
export interface RankTier {
  readonly title: string;
  readonly minLevel: number;
}

export const RANK_TIERS: readonly RankTier[] = [
  { title: 'Lake Explorer', minLevel: 1 },
  { title: 'Lake Local', minLevel: 3 },
  { title: 'Lake Regular', minLevel: 7 },
  { title: 'Lake Enthusiast', minLevel: 15 },
  { title: 'Lake Champion', minLevel: 25 },
  { title: 'Lake Ambassador', minLevel: 41 },
  { title: 'Lake Keeper', minLevel: 60 },
  { title: 'Lake Guardian', minLevel: 80 },
  { title: 'Lake Legend', minLevel: 100 },
];

// The level range a tier covers, for display (e.g. "15–24" or "100+" for
// the last, open-ended tier).
export function rankLevelRange(index: number): string {
  const tier = RANK_TIERS[index];
  const next = RANK_TIERS[index + 1];
  return next ? `${tier.minLevel}–${next.minLevel - 1}` : `${tier.minLevel}+`;
}

// The index into RANK_TIERS a given level currently falls under.
export function currentRankIndex(level: number): number {
  let index = 0;
  for (let candidate = 0; candidate < RANK_TIERS.length; candidate += 1) {
    if (level < RANK_TIERS[candidate].minLevel) {
      break;
    }
    index = candidate;
  }
  return index;
}

export function titleForLevel(level: number): string {
  return RANK_TIERS[currentRankIndex(level)].title;
}

// Mirrors src/backend/progress/level.ts's xpSpanForLevel (same "frontend
// never imports from backend" precedent as RANK_TIERS above) -- 5% growth
// from a 300 XP base, capped at 900 XP/level so the climb settles into a
// steady rate instead of spiralling upward forever.
const LEVEL_XP_BASE = 300;
const LEVEL_XP_GROWTH = 1.05;
export const LEVEL_XP_CAP = 900;

function xpSpanForLevel(level: number): number {
  return Math.min(LEVEL_XP_CAP, Math.round(LEVEL_XP_BASE * LEVEL_XP_GROWTH ** (level - 1)));
}

export interface LevelCost {
  readonly level: number;
  // Cumulative XP required to *reach* this level -- level 1 is free (0),
  // level 2 is xpSpanForLevel(1), level 3 is xpSpanForLevel(1) +
  // xpSpanForLevel(2), and so on. Not the level's own span: that's the gap
  // between this row and the next one's xp.
  readonly xp: number;
}

// Cumulative XP needed to reach every level up to and including the first
// one whose own span hits the flat LEVEL_XP_CAP -- from there every further
// level adds exactly LEVEL_XP_CAP more, so the list stops growing once that
// transition has been shown once (the caller renders that last entry as
// open-ended, e.g. "24+").
export function levelCosts(): readonly LevelCost[] {
  const costs: LevelCost[] = [];
  let level = 1;
  let cumulative = 0;
  let span = xpSpanForLevel(level);
  while (span < LEVEL_XP_CAP) {
    costs.push({ level, xp: cumulative });
    cumulative += span;
    level += 1;
    span = xpSpanForLevel(level);
  }
  costs.push({ level, xp: cumulative });
  return costs;
}

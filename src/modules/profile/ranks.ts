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

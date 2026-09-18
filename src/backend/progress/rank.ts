export interface RankTier {
  readonly title: string;
  readonly minLevel: number;
}

// Ascending by level -- also the order a "ranks" list should render in, so
// users can see what they're building toward. Banded against the level
// curve in level.ts (300 XP base, 5% growth, 900 XP cap) so each tier spans
// a meaningfully longer stretch of engagement than the last: a first
// mission or post reaches Lake Explorer, while Lake Legend (100+) is a
// decade-plus-of-activity capstone rather than a realistically common rank.
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

export function titleForLevel(level: number): string {
  let current = RANK_TIERS[0].title;
  for (const tier of RANK_TIERS) {
    if (level < tier.minLevel) {
      break;
    }
    current = tier.title;
  }
  return current;
}

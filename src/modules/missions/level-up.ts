// Pure so it's unit-testable via `bun:test` without pulling in React Native
// through use-missions.ts's query/session/haptics imports. previousLevel is
// undefined when there was no cached view yet (e.g. first load), in which
// case there's nothing to compare against and no level-up is reported.
export function computeLeveledUpTo(
  previousLevel: number | undefined,
  newLevel: number,
): number | null {
  return previousLevel !== undefined && newLevel > previousLevel ? newLevel : null;
}

// Mirrors src/modules/profile/ranks.ts's RANK_TIERS (itself already a
// deliberate mirror of src/backend/progress/rank.ts -- see that file's own
// WHY). Duplicated here rather than imported from the profile module's
// barrel because that barrel also exports RN screen components, and this
// file is kept free of React Native imports so it (and level-up.test.ts)
// keep running under plain `bun test`, not just the RN-aware jest suite.
const RANK_TITLES: readonly { readonly title: string; readonly minLevel: number }[] = [
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

function titleForLevel(level: number): string {
  let title = RANK_TITLES[0].title;
  for (const tier of RANK_TITLES) {
    if (level < tier.minLevel) {
      break;
    }
    title = tier.title;
  }
  return title;
}

// A rank-up is rarer than a plain level-up (most level-ups stay within the
// same rank tier) and gets a bigger, separate celebration -- see
// RankUpCelebrationModal. Returns the new tier's title only when crossing
// into it, not on every level-up.
export function computeRankedUpTo(
  previousLevel: number | undefined,
  newLevel: number,
): string | null {
  if (previousLevel === undefined || newLevel <= previousLevel) {
    return null;
  }
  const previousTitle = titleForLevel(previousLevel);
  const newTitle = titleForLevel(newLevel);
  return previousTitle === newTitle ? null : newTitle;
}

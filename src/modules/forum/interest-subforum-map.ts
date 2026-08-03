// Interest strings (src/modules/onboarding's INTERESTS) don't share an exact
// vocabulary with subforum names (seeded in src/backend/store/seed.ts) — e.g.
// "Boating & marina" vs "Marina & Boating" — so matching needs an explicit
// table rather than a string comparison. Interests with no clear forum
// equivalent (Family things, Photography, Book club, Wine & tastings,
// Volunteering) are left unmapped on purpose: an honest empty result for
// those beats a forced, misleading match.
export const INTEREST_SUBFORUM_MAP: Readonly<Record<string, string>> = {
  'Boating & marina': 'Marina & Boating',
  'Trails & fitness': 'Trails',
  'Dining out': 'Dining',
  'Live events': 'Events',
  'Buy & sell': 'Buy & Sell',
  Golf: 'Golf',
  'Paddle sports': 'Marina & Boating',
};

export function subforumsForInterests(
  interests: readonly string[],
): ReadonlySet<string> {
  const subforums = new Set<string>();
  for (const interest of interests) {
    const subforum = INTEREST_SUBFORUM_MAP[interest];
    if (subforum) {
      subforums.add(subforum);
    }
  }
  return subforums;
}

// Interest strings (src/modules/onboarding's INTERESTS) don't share an exact
// vocabulary with subforum names (seeded in src/backend/store/seed.ts) — e.g.
// "Boating & marina" vs "Marina & Boating" — so matching needs an explicit
// table rather than a string comparison. Several interests share a subforum
// on purpose (Paddle sports groups under boating; Wine & tastings groups
// under Dining) since there are deliberately more interests than subforums.
// Remaining gaps are intentional, not oversights:
//  - Family things, Photography, and Book club stay unmapped: there's no
//    subforum whose content is genuinely about them, and an honest empty
//    result beats a forced, misleading match.
//  - HOA stays uncovered by any interest: it's an official/governance
//    channel, not something anyone would pick as a personal interest.
export const INTEREST_SUBFORUM_MAP: Readonly<Record<string, string>> = {
  'Boating & marina': 'Marina & Boating',
  'Paddle sports': 'Marina & Boating',
  'Trails & fitness': 'Trails',
  'Dining out': 'Dining',
  'Wine & tastings': 'Dining',
  'Live events': 'Events',
  'Buy & sell': 'Buy & Sell',
  Golf: 'Golf',
  'Pickleball & tennis': 'Sports Club',
  Volunteering: 'Announcements',
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

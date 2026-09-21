// Mirrors src/backend/xp/types.ts's XpGrantOutcome -- frontend modules never
// import from src/backend (see src/modules/profile/ranks.ts's own precedent),
// so the shape is kept in sync here by hand instead. Every XP-earning
// mutation's response carries this so useNotifyXpAwarded can decide what
// feedback to show without guessing at a locally-cached "level before this".
export interface XpAwardOutcome {
  readonly awardedXp: number;
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly title: string;
}

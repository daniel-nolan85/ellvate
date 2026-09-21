import type { XpReason } from '@/src/backend/store';

export type { XpReason };

export interface XpLedgerEntry {
  readonly id: string;
  readonly amount: number;
  readonly reason: XpReason;
  readonly refId: string | null;
  readonly createdAt: string;
}

export interface XpLedgerPage {
  readonly entries: readonly XpLedgerEntry[];
  readonly nextCursor: string | null;
}

export interface GrantXpInput {
  readonly amount: number;
  readonly reason: XpReason;
  readonly refId?: string | null;
}

// What a grant actually did, for the client to decide what feedback to
// show -- a routine toast, or (when previousLevel < the level newXp maps
// to) a level-up/rank-up celebration. previousLevel/title are computed
// from the user's real stored XP immediately before this grant, the same
// server-authoritative approach missions/check-in.ts uses and for the same
// reason: a client-side cache of "what level was I at" can be stale (a
// second device, a long-backgrounded app, XP earned elsewhere since the
// cache last loaded), silently swallowing a real celebration.
export interface XpGrantOutcome {
  readonly awardedXp: number;
  readonly previousLevel: number;
  readonly newLevel: number;
  // The rank title at newLevel, regardless of whether the rank itself
  // changed -- mirrors CheckInCelebration's own `title` field.
  readonly title: string;
}

export interface XpGrowthPoint {
  // Monday (UTC) of the bucketed week, as YYYY-MM-DD.
  readonly weekStart: string;
  readonly xpEarned: number;
  readonly cumulativeXp: number;
}

export interface XpGrowthResponse {
  readonly points: readonly XpGrowthPoint[];
}

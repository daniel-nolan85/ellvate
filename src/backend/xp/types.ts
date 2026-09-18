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

export interface XpGrowthPoint {
  // Monday (UTC) of the bucketed week, as YYYY-MM-DD.
  readonly weekStart: string;
  readonly xpEarned: number;
  readonly cumulativeXp: number;
}

export interface XpGrowthResponse {
  readonly points: readonly XpGrowthPoint[];
}

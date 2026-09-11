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

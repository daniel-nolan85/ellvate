import type { SupabaseClient } from '@supabase/supabase-js';

import {
  decodeCursor,
  encodeCursor,
  paginateInMemory,
} from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { RequestContext } from '@/src/backend/http';
import { getState, type XpReason } from '@/src/backend/store';

import type { XpLedgerPage } from './types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface GetXpLedgerOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
  readonly reasons?: readonly XpReason[];
}

function getXpLedgerMemory(
  userId: string,
  limit: number,
  cursor: string | null,
  reasons: readonly XpReason[] | undefined,
): XpLedgerPage {
  const state = getState();
  const reasonSet = reasons && reasons.length > 0 ? new Set(reasons) : null;
  const filtered = state.xpLedger
    .filter((entry) => entry.userId === userId)
    .filter((entry) => !reasonSet || reasonSet.has(entry.reason))
    .map((entry) => ({ ...entry, sortKey: entry.createdAt }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    entries: page.items.map(({ sortKey: _sortKey, userId: _userId, ...entry }) => entry),
    nextCursor: page.nextCursor,
  };
}

interface XpLedgerRow {
  readonly id: string;
  readonly amount: number;
  readonly reason: XpReason;
  readonly ref_id: string | null;
  readonly created_at: string;
}

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// Mirrors the same-shaped helper in src/backend/forum/posts-supabase.ts --
// each domain module keeps its own copy since the column names it closes
// over (here, `created_at`/`id` on xp_ledger) are specific to that table.
function safeCursorOrFilter(
  parsedCursor: { readonly sortKey: string; readonly id: string } | null,
): string | null {
  if (!parsedCursor) {
    return null;
  }
  if (
    !ISO_TIMESTAMP_PATTERN.test(parsedCursor.sortKey) ||
    !SAFE_ID_PATTERN.test(parsedCursor.id)
  ) {
    return null;
  }
  return `created_at.lt.${parsedCursor.sortKey},and(created_at.eq.${parsedCursor.sortKey},id.lt.${parsedCursor.id})`;
}

async function getXpLedgerSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
  reasons: readonly XpReason[] | undefined,
): Promise<XpLedgerPage> {
  let query = supabase
    .from('xp_ledger')
    .select('id,amount,reason,ref_id,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (reasons && reasons.length > 0) {
    query = query.in('reason', reasons);
  }

  const cursorFilter = safeCursorOrFilter(cursor ? decodeCursor(cursor) : null);
  if (cursorFilter) {
    query = query.or(cursorFilter);
  }

  const { data, error } = await query;
  throwIfSupabaseError(error, 'load xp ledger');
  const rows = (data ?? []) as unknown as XpLedgerRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ id: last.id, sortKey: last.created_at }) : null;

  return {
    entries: page.map((row) => ({
      amount: row.amount,
      createdAt: row.created_at,
      id: row.id,
      reason: row.reason,
      refId: row.ref_id,
    })),
    nextCursor,
  };
}

export async function getXpLedger(
  ctx: RequestContext,
  options: GetXpLedgerOptions,
): Promise<XpLedgerPage> {
  const limit = Math.min(
    Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const cursor = options.cursor ?? null;
  return ctx.supabase
    ? getXpLedgerSupabase(ctx.supabase, ctx.userId, limit, cursor, options.reasons)
    : getXpLedgerMemory(ctx.userId, limit, cursor, options.reasons);
}

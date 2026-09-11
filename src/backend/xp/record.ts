import type { SupabaseClient } from '@supabase/supabase-js';

import type { RequestContext } from '@/src/backend/http';
import { setState } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { GrantXpInput } from './types';

function recordXpLedgerEntryMemory(userId: string, input: GrantXpInput): void {
  setState((state) => ({
    ...state,
    xpLedger: [
      ...state.xpLedger,
      {
        amount: input.amount,
        createdAt: new Date().toISOString(),
        id: `xp-${crypto.randomUUID()}`,
        reason: input.reason,
        refId: input.refId ?? null,
        userId,
      },
    ],
  }));
}

async function recordXpLedgerEntrySupabase(
  supabase: SupabaseClient,
  userId: string,
  input: GrantXpInput,
): Promise<void> {
  const { error } = await supabase.from('xp_ledger').insert({
    amount: input.amount,
    reason: input.reason,
    ref_id: input.refId ?? null,
    user_id: userId,
  });
  throwIfSupabaseError(error, 'record xp ledger entry');
}

// Inserts one ledger row without touching app_users.xp -- for call sites
// that already mutate xp themselves (mission completion, the onboarding
// bonus) and just need the audit trail added alongside their existing,
// already-tested update. A new XP-earning action that doesn't yet mutate xp
// anywhere should use grantXp instead, which does both.
export async function recordXpLedgerEntry(
  ctx: RequestContext,
  input: GrantXpInput,
): Promise<void> {
  if (ctx.supabase) {
    await recordXpLedgerEntrySupabase(ctx.supabase, ctx.userId, input);
    return;
  }
  recordXpLedgerEntryMemory(ctx.userId, input);
}

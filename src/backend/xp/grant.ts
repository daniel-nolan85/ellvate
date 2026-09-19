import type { SupabaseClient } from '@supabase/supabase-js';

import type { RequestContext } from '@/src/backend/http';
import { ensureUser, setState } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { recordXpLedgerEntry } from './record';
import type { GrantXpInput } from './types';

// Small enough to sit well below the lowest real mission-completion reward
// (the smallest seeded mission is worth 25 XP), so actually completing a
// mission always outweighs just posting content. Keeping this amount small
// is itself the anti-farming measure -- there's no separate cooldown/cap.
export const CREATE_CONTENT_XP = 10;

function grantXpMemory(userId: string, input: GrantXpInput): void {
  ensureUser(userId);
  setState((state) => ({
    ...state,
    users: state.users.map((user) =>
      user.id === userId ? { ...user, xp: user.xp + input.amount } : user,
    ),
  }));
}

// Bumps app_users.xp and inserts the matching xp_ledger row in one atomic,
// dedupe-safe call -- see grant_xp_and_log in
// supabase/migrations/0064_atomic_grant_xp.sql for why this replaced two
// separate writes (a ledger-insert failure after a committed xp bump used
// to leave app_users.xp permanently ahead of the ledger's own sum).
async function grantXpSupabase(
  supabase: SupabaseClient,
  input: GrantXpInput,
): Promise<void> {
  const { error } = await supabase.rpc('grant_xp_and_log', {
    p_amount: input.amount,
    p_ref_id: input.refId ?? null,
    p_reason: input.reason,
  });
  throwIfSupabaseError(error, 'grant xp');
}

// Bumps the caller's xp and records the matching ledger entry together --
// for XP-earning actions that don't already have their own xp-mutation code
// elsewhere (creating a mission/post/event/service). Mission completion and
// the onboarding bonus keep their own existing xp updates and call
// recordXpLedgerEntry (Supabase: grant_xp_and_log) directly instead, so
// this never touches either.
export async function grantXp(
  ctx: RequestContext,
  input: GrantXpInput,
): Promise<void> {
  if (ctx.supabase) {
    await grantXpSupabase(ctx.supabase, input);
    return;
  }
  grantXpMemory(ctx.userId, input);
  await recordXpLedgerEntry(ctx, input);
}

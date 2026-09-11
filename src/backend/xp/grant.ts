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
export const CREATE_CONTENT_XP = 5;

function grantXpMemory(userId: string, input: GrantXpInput): void {
  ensureUser(userId);
  setState((state) => ({
    ...state,
    users: state.users.map((user) =>
      user.id === userId ? { ...user, xp: user.xp + input.amount } : user,
    ),
  }));
}

async function grantXpSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: GrantXpInput,
): Promise<void> {
  const { data, error } = await supabase
    .from('app_users')
    .select('xp')
    .eq('id', userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'load user xp');
  const baseXp = (data as { xp: number } | null)?.xp ?? 0;

  const { error: updateError } = await supabase
    .from('app_users')
    .update({ xp: baseXp + input.amount })
    .eq('id', userId);
  throwIfSupabaseError(updateError, 'grant xp');
}

// Bumps the caller's xp and records the matching ledger entry together --
// for XP-earning actions that don't already have their own xp-mutation code
// elsewhere (creating a mission/post/event/service). Mission completion and
// the onboarding bonus keep their own existing xp updates and call
// recordXpLedgerEntry directly instead, so this never touches either.
export async function grantXp(
  ctx: RequestContext,
  input: GrantXpInput,
): Promise<void> {
  if (ctx.supabase) {
    await grantXpSupabase(ctx.supabase, ctx.userId, input);
  } else {
    grantXpMemory(ctx.userId, input);
  }
  await recordXpLedgerEntry(ctx, input);
}

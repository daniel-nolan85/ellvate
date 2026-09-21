import type { SupabaseClient } from '@supabase/supabase-js';

import type { RequestContext } from '@/src/backend/http';
import { computeProgress, titleForLevel } from '@/src/backend/progress';
import { ensureUser, getState, setState } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { recordXpLedgerEntry } from './record';
import type { GrantXpInput, XpGrantOutcome } from './types';

// Small enough to sit well below the lowest real mission-completion reward
// (the smallest seeded mission is worth 25 XP), so actually completing a
// mission always outweighs just posting content. Keeping this amount small
// is itself the anti-farming measure -- there's no separate cooldown/cap.
export const CREATE_CONTENT_XP = 10;

function grantXpMemory(userId: string, input: GrantXpInput): XpGrantOutcome {
  ensureUser(userId);
  const previousXp = getState().users.find((user) => user.id === userId)?.xp ?? 0;
  setState((state) => ({
    ...state,
    users: state.users.map((user) =>
      user.id === userId ? { ...user, xp: user.xp + input.amount } : user,
    ),
  }));
  const newLevel = computeProgress(previousXp + input.amount).level;
  return {
    awardedXp: input.amount,
    newLevel,
    previousLevel: computeProgress(previousXp).level,
    title: titleForLevel(newLevel),
  };
}

// Bumps app_users.xp and inserts the matching xp_ledger row in one atomic,
// dedupe-safe call -- see grant_xp_and_log in
// supabase/migrations/0064_atomic_grant_xp.sql for why this replaced two
// separate writes (a ledger-insert failure after a committed xp bump used
// to leave app_users.xp permanently ahead of the ledger's own sum).
async function grantXpSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: GrantXpInput,
): Promise<XpGrantOutcome> {
  const { data: userRow, error: userError } = await supabase
    .from('app_users')
    .select('xp')
    .eq('id', userId)
    .maybeSingle();
  throwIfSupabaseError(userError, 'load user xp');
  const previousXp = (userRow as { xp: number } | null)?.xp ?? 0;

  const { error } = await supabase.rpc('grant_xp_and_log', {
    p_amount: input.amount,
    p_ref_id: input.refId ?? null,
    p_reason: input.reason,
  });
  throwIfSupabaseError(error, 'grant xp');

  const newLevel = computeProgress(previousXp + input.amount).level;
  return {
    awardedXp: input.amount,
    newLevel,
    previousLevel: computeProgress(previousXp).level,
    title: titleForLevel(newLevel),
  };
}

// Bumps the caller's xp and records the matching ledger entry together --
// for XP-earning actions that don't already have their own xp-mutation code
// elsewhere (creating a mission/post/event/service). Mission completion and
// the onboarding bonus keep their own existing xp updates and call
// recordXpLedgerEntry (Supabase: grant_xp_and_log) directly instead, so
// this never touches either -- see their own previousLevel computations
// (check-in.ts/missions-supabase.ts, profile.ts/profile-supabase.ts) for
// the same outcome shape computed the same way.
export async function grantXp(
  ctx: RequestContext,
  input: GrantXpInput,
): Promise<XpGrantOutcome> {
  if (ctx.supabase) {
    return grantXpSupabase(ctx.supabase, ctx.userId, input);
  }
  const outcome = grantXpMemory(ctx.userId, input);
  await recordXpLedgerEntry(ctx, input);
  return outcome;
}

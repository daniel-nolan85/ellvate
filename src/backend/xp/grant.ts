import type { SupabaseClient } from '@supabase/supabase-js';

import type { RequestContext } from '@/src/backend/http';
import { computeProgress, titleForLevel } from '@/src/backend/progress';
import { ensureUser, getState, setState } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { recordXpLedgerEntry } from './record';
import type { GrantXpInput, XpGrantOutcome } from './types';

// A safe placeholder for a create-content result's xpAward when the grant
// itself fails after the entity was already fully created -- see
// createPost/createEvent/createMission/createServiceListing's own WHY.
// awardedXp: 0 means the client's useNotifyXpAwarded no-ops on it, so this
// never shows a bogus toast/celebration for XP that wasn't actually
// granted.
export const NO_XP_AWARD: XpGrantOutcome = {
  awardedXp: 0,
  newLevel: 0,
  previousLevel: 0,
  title: '',
};

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
//
// previousXp is derived from the RPC's own returned new xp (newXp -
// input.amount) rather than a separate read beforehand -- an earlier
// version of this function did read first, which added a second network
// round-trip purely to compute a number this one already implies.
async function grantXpSupabase(
  supabase: SupabaseClient,
  input: GrantXpInput,
): Promise<XpGrantOutcome> {
  const { data, error } = await supabase.rpc('grant_xp_and_log', {
    p_amount: input.amount,
    p_ref_id: input.refId ?? null,
    p_reason: input.reason,
  });
  throwIfSupabaseError(error, 'grant xp');

  // null means this exact (user, reason, ref_id) grant was already
  // recorded (a dedupe no-op) -- essentially impossible for the create-
  // content callers below, since refId is always the entity's own
  // freshly generated id, but handled defensively rather than assumed
  // away: no XP was actually granted, so there's no real level to report.
  if (data === null) {
    return NO_XP_AWARD;
  }

  const newXp = data as number;
  const previousXp = newXp - input.amount;
  const newLevel = computeProgress(newXp).level;
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
    return grantXpSupabase(ctx.supabase, input);
  }
  const outcome = grantXpMemory(ctx.userId, input);
  await recordXpLedgerEntry(ctx, input);
  return outcome;
}

import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

// Single source of truth for "how many members does this community have"
// -- both the unlock gate and the per-petition required-signature math call
// this, so the two thresholds never drift relative to each other.
export async function countAppUsers(ctx: RequestContext): Promise<number> {
  if (!ctx.supabase) {
    return getState().users.length;
  }
  const { count, error } = await ctx.supabase
    .from('app_users')
    .select('id', { count: 'exact', head: true });
  throwIfSupabaseError(error, 'count app users');
  return count ?? 0;
}

// Lets an admin see and use petitions before the community hits
// PETITIONS_UNLOCK_MIN_USERS -- e.g. so an App Store reviewer's admin
// account can actually exercise the feature pre-launch, without lowering
// the threshold (and thus unlocking it early) for everyone else.
export async function isCallerAdmin(ctx: RequestContext): Promise<boolean> {
  if (!ctx.supabase) {
    return getState().users.find((user) => user.id === ctx.userId)?.isAdmin ?? false;
  }
  const { data, error } = await ctx.supabase
    .from('app_users')
    .select('is_admin')
    .eq('id', ctx.userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'check admin status');
  return (data as { is_admin: boolean } | null)?.is_admin ?? false;
}

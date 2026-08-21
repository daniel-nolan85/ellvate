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

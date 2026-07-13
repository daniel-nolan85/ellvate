import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';

import { listSubforumsSupabase } from './posts-supabase';

export async function listSubforums(
  ctx: RequestContext,
): Promise<readonly string[]> {
  return ctx.supabase ? listSubforumsSupabase(ctx.supabase) : getState().subforums;
}

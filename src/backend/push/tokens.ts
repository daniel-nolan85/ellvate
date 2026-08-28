import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { RequestContext } from '@/src/backend/http';
import { defaultDisplayName } from '@/src/backend/store';

import { validatePushToken, type ValidatedPushToken } from './validation';

export type StorePushTokenResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: 'invalid_token';
      readonly message: string;
    };

// A new Clerk user has no app_users row yet; create it before the owned write so
// the push_tokens foreign key resolves. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert(
      { id: userId, name: defaultDisplayName(userId) },
      { ignoreDuplicates: true, onConflict: 'id' },
    );
  throwIfSupabaseError(error, 'ensure push user');
};

async function storePushTokenSupabase(
  supabase: SupabaseClient,
  userId: string,
  value: ValidatedPushToken,
): Promise<StorePushTokenResult> {
  await ensureUser(supabase, userId);
  // Not a plain upsert: the same device token can legitimately belong to a
  // different user than last time (a device handed off between accounts),
  // and RLS's own-row-only update policy would reject that case outright --
  // see 0045_push_token_handoff.sql for why this needs a SECURITY DEFINER RPC.
  const { error } = await supabase.rpc('claim_push_token', {
    p_platform: value.platform,
    p_token: value.token,
  });
  throwIfSupabaseError(error, 'store push token');
  return { ok: true };
}

export async function storePushToken(
  ctx: RequestContext,
  input: unknown,
): Promise<StorePushTokenResult> {
  const validation = validatePushToken(input);
  if (!validation.ok) {
    return validation;
  }
  // Push tokens are only meaningful with a real device and database. The
  // in-memory backend (tests / no-DB dev) validates and accepts without storing.
  if (!ctx.supabase) {
    return { ok: true };
  }
  return storePushTokenSupabase(ctx.supabase, ctx.userId, validation.value);
}

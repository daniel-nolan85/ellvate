import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { RequestContext } from '@/src/backend/http';

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
      { id: userId, name: 'Member' },
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
  const { error } = await supabase.from('push_tokens').upsert(
    {
      token: value.token,
      user_id: userId,
      platform: value.platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
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

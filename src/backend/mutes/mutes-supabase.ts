import type { SupabaseClient } from '@supabase/supabase-js';

import { defaultDisplayName } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { ToggleMuteResult } from './types';

// A new Clerk user has no app_users row yet; create it before any owned write
// so foreign keys resolve. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = defaultDisplayName(userId),
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure mute user');
};

export async function toggleMuteSupabase(
  supabase: SupabaseClient,
  userId: string,
  mutedUserId: string,
): Promise<ToggleMuteResult> {
  await ensureUser(supabase, userId);

  const { data: existing, error: existingError } = await supabase
    .from('user_mutes')
    .select('muted_id')
    .eq('muter_id', userId)
    .eq('muted_id', mutedUserId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load mute');

  if (existing) {
    const { error } = await supabase
      .from('user_mutes')
      .delete()
      .eq('muter_id', userId)
      .eq('muted_id', mutedUserId);
    throwIfSupabaseError(error, 'unmute user');
    return { muted: false, mutedUserId };
  }

  const { error } = await supabase
    .from('user_mutes')
    .insert({ muter_id: userId, muted_id: mutedUserId });
  throwIfSupabaseError(error, 'mute user');
  return { muted: true, mutedUserId };
}

export async function getMutedUserIdsSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<readonly string[]> {
  const { data, error } = await supabase
    .from('user_mutes')
    .select('muted_id')
    .eq('muter_id', userId);
  throwIfSupabaseError(error, 'load mutes');
  return (data ?? []).map((row) => row.muted_id as string);
}

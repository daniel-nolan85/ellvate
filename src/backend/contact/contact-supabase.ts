import type { SupabaseClient } from '@supabase/supabase-js';

import type { ContactMessageCategory } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { SubmitContactMessageResult } from './types';

const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = 'Member',
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure contact message user');
};

export async function submitContactMessageSupabase(
  supabase: SupabaseClient,
  userId: string,
  category: ContactMessageCategory,
  message: string,
): Promise<SubmitContactMessageResult> {
  await ensureUser(supabase, userId);

  const { data, error } = await supabase
    .from('contact_messages')
    .insert({ category, message, user_id: userId })
    .select('id')
    .single();
  throwIfSupabaseError(error, 'submit contact message');

  return { id: (data as { id: string }).id, ok: true };
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { ReportPostResult } from './types';

const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = 'Member',
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure report user');
};

export async function reportPostSupabase(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
): Promise<ReportPostResult> {
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle();
  throwIfSupabaseError(postError, 'load reported post');
  if (!post) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }

  await ensureUser(supabase, userId);
  // Idempotent: a unique (post_id, reporter_id) constraint on post_reports
  // means a repeat report from the same user is a silent no-op, not an error.
  const { error } = await supabase
    .from('post_reports')
    .upsert(
      { post_id: postId, reporter_id: userId },
      { ignoreDuplicates: true, onConflict: 'post_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report post');
  return { ok: true, reported: true };
}

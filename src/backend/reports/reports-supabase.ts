import type { SupabaseClient } from '@supabase/supabase-js';

import { defaultDisplayName } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { uploadReportEvidence, type ValidReportSubmission } from './report-submission';
import type { ReportPostResult } from './types';

const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = defaultDisplayName(userId),
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
  submission: ValidReportSubmission,
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
  const evidenceImageUrl = await uploadReportEvidence(
    supabase,
    userId,
    submission.evidenceImageDataUrl,
  );
  // Idempotent: a unique (post_id, reporter_id) constraint on post_reports
  // means a repeat report from the same user is a silent no-op, not an error.
  const { error } = await supabase.from('post_reports').upsert(
    {
      details: submission.details,
      evidence_image_url: evidenceImageUrl,
      post_id: postId,
      reason: submission.reason,
      reporter_id: userId,
    },
    { ignoreDuplicates: true, onConflict: 'post_id,reporter_id' },
  );
  throwIfSupabaseError(error, 'report post');
  return { ok: true, reported: true };
}

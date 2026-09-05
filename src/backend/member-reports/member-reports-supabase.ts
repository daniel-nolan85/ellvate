import type { SupabaseClient } from '@supabase/supabase-js';

import { defaultDisplayName } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { uploadReportEvidence, type ValidReportSubmission } from '../reports/report-submission';
import type { ReportMemberResult } from './types';

const ensureUser = async (supabase: SupabaseClient, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert(
      { id: userId, name: defaultDisplayName(userId) },
      { ignoreDuplicates: true, onConflict: 'id' },
    );
  throwIfSupabaseError(error, 'ensure member report user');
};

export async function reportMemberSupabase(
  supabase: SupabaseClient,
  userId: string,
  reportedUserId: string,
  submission: ValidReportSubmission,
): Promise<ReportMemberResult> {
  const { data: member, error: memberError } = await supabase
    .from('app_users')
    .select('id')
    .eq('id', reportedUserId)
    .maybeSingle();
  throwIfSupabaseError(memberError, 'load reported member');
  if (!member) {
    return { code: 'member_not_found', message: 'Member not found.', ok: false };
  }

  await ensureUser(supabase, userId);
  const evidenceImageUrl = await uploadReportEvidence(
    supabase,
    userId,
    submission.evidenceImageDataUrl,
  );
  // Idempotent: a unique (reporter_id, reported_user_id) constraint on
  // member_reports means a repeat report from the same user is a silent
  // no-op, not an error.
  const { error } = await supabase.from('member_reports').upsert(
    {
      details: submission.details,
      evidence_image_url: evidenceImageUrl,
      reason: submission.reason,
      reported_user_id: reportedUserId,
      reporter_id: userId,
    },
    { ignoreDuplicates: true, onConflict: 'reporter_id,reported_user_id' },
  );
  throwIfSupabaseError(error, 'report member');
  return { ok: true, reported: true };
}

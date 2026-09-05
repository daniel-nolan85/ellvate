import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import type { ValidReportSubmission } from '../reports/report-submission';
import { reportMemberSupabase } from './member-reports-supabase';
import type { ReportMemberResult } from './types';

function reportMemberMemory(
  userId: string,
  reportedUserId: string,
  submission: ValidReportSubmission,
): ReportMemberResult {
  if (!getState().users.some((user) => user.id === reportedUserId)) {
    return { code: 'member_not_found', message: 'Member not found.', ok: false };
  }

  const alreadyReported = getState().memberReports.some(
    (report) => report.reportedUserId === reportedUserId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      memberReports: [
        ...current.memberReports,
        {
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `member-report-${crypto.randomUUID()}`,
          reason: submission.reason,
          reportedUserId,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

export async function reportMember(
  ctx: RequestContext,
  reportedUserId: string,
  submission: ValidReportSubmission,
): Promise<ReportMemberResult> {
  if (ctx.userId === reportedUserId) {
    return { code: 'cannot_report_self', message: 'You can’t report yourself.', ok: false };
  }
  return ctx.supabase
    ? reportMemberSupabase(ctx.supabase, ctx.userId, reportedUserId, submission)
    : reportMemberMemory(ctx.userId, reportedUserId, submission);
}

import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { reportMemberSupabase } from './member-reports-supabase';
import type { ReportMemberResult } from './types';

function reportMemberMemory(userId: string, reportedUserId: string): ReportMemberResult {
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
          id: `member-report-${crypto.randomUUID()}`,
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
): Promise<ReportMemberResult> {
  if (ctx.userId === reportedUserId) {
    return { code: 'cannot_report_self', message: 'You can’t report yourself.', ok: false };
  }
  return ctx.supabase
    ? reportMemberSupabase(ctx.supabase, ctx.userId, reportedUserId)
    : reportMemberMemory(ctx.userId, reportedUserId);
}

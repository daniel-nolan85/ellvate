import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import type { ValidReportSubmission } from './report-submission';
import { reportPostSupabase } from './reports-supabase';
import type { ReportPostResult } from './types';

function reportPostMemory(
  userId: string,
  postId: string,
  submission: ValidReportSubmission,
): ReportPostResult {
  if (!getState().posts.some((post) => post.id === postId)) {
    return { code: 'post_not_found', message: 'Post not found.', ok: false };
  }

  const alreadyReported = getState().postReports.some(
    (report) => report.postId === postId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      postReports: [
        ...current.postReports,
        {
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `report-${crypto.randomUUID()}`,
          postId,
          reason: submission.reason,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

export async function reportPost(
  ctx: RequestContext,
  postId: string,
  submission: ValidReportSubmission,
): Promise<ReportPostResult> {
  return ctx.supabase
    ? reportPostSupabase(ctx.supabase, ctx.userId, postId, submission)
    : reportPostMemory(ctx.userId, postId, submission);
}

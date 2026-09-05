import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';
import { reportMission } from '@/src/backend/missions';
import { parseReportSubmission } from '@/src/backend/reports';

export async function POST(
  request: Request,
  { id }: { id: string },
): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.report,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many reports. Try again shortly.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const submission = parseReportSubmission(body ?? {});
    if (!submission.ok) {
      return jsonError(400, submission.code, submission.message);
    }

    const result = await reportMission(ctx, id, submission.submission);
    if (!result.ok) {
      return jsonError(404, result.code, result.message);
    }
    return jsonOk({ reported: result.reported });
  });
}

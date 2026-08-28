import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { reportMissionSupabase } from './missions-supabase';
import type { ReportMissionResult } from './types';

function reportMissionMemory(
  userId: string,
  missionId: string,
): ReportMissionResult {
  if (!getState().missions.some((mission) => mission.id === missionId)) {
    return {
      code: 'mission_not_found',
      message: 'Mission not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().missionReports.some(
    (report) => report.missionId === missionId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      missionReports: [
        ...current.missionReports,
        {
          createdAt: new Date().toISOString(),
          id: `mission-report-${crypto.randomUUID()}`,
          missionId,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

export async function reportMission(
  ctx: RequestContext,
  missionId: string,
): Promise<ReportMissionResult> {
  return ctx.supabase
    ? reportMissionSupabase(ctx.supabase, ctx.userId, missionId)
    : reportMissionMemory(ctx.userId, missionId);
}

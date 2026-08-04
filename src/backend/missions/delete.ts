import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { deleteMissionSupabase } from './missions-supabase';

function deleteMissionMemory(userId: string, missionId: string): boolean {
  const existing = getState().missions.find(
    (mission) => mission.id === missionId && mission.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => {
    const removedCommentIds = new Set(
      current.missionComments
        .filter((comment) => comment.missionId === missionId)
        .map((comment) => comment.id),
    );
    const removedCheckInIds = new Set(
      current.missionCheckIns
        .filter((checkIn) => checkIn.missionId === missionId)
        .map((checkIn) => checkIn.id),
    );
    return {
      ...current,
      missionCommentReports: current.missionCommentReports.filter(
        (report) => !removedCommentIds.has(report.missionCommentId),
      ),
      missionComments: current.missionComments.filter(
        (comment) => comment.missionId !== missionId,
      ),
      missionCheckInReports: current.missionCheckInReports.filter(
        (report) => !removedCheckInIds.has(report.checkInId),
      ),
      missionCheckIns: current.missionCheckIns.filter(
        (checkIn) => checkIn.missionId !== missionId,
      ),
      missions: current.missions.filter((mission) => mission.id !== missionId),
    };
  });
  return true;
}

export async function deleteMission(
  ctx: RequestContext,
  missionId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteMissionSupabase(ctx.supabase, ctx.userId, missionId)
    : deleteMissionMemory(ctx.userId, missionId);
}

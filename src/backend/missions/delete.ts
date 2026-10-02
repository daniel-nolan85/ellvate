import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';
import { revokeXp } from '@/src/backend/xp';

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
      missionCheckInPhotoReports: current.missionCheckInPhotoReports.filter(
        (report) => !removedCheckInIds.has(report.checkInId),
      ),
      missionCheckIns: current.missionCheckIns.filter(
        (checkIn) => checkIn.missionId !== missionId,
      ),
      missionReports: current.missionReports.filter(
        (report) => report.missionId !== missionId,
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
  const deleted = ctx.supabase
    ? await deleteMissionSupabase(ctx.supabase, ctx.userId, missionId)
    : deleteMissionMemory(ctx.userId, missionId);
  // Supabase mode: a matching AFTER DELETE trigger on the missions table
  // does this atomically with the delete itself (both reasons at once) --
  // see supabase/migrations/0074_revoke_xp_on_delete.sql -- so revokeXp
  // no-ops there; this only does real work in memory mode. Both the
  // mission's own creation grant and every member's completion grant are
  // keyed by the mission's own id as refId.
  if (deleted) {
    revokeXp(ctx, { reason: 'mission_created', refId: missionId });
    revokeXp(ctx, { reason: 'mission_completed', refId: missionId });
  }
  return deleted;
}

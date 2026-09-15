import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import type { ValidReportSubmission } from '../reports/report-submission';
import { reportMissionCheckInPhotoSupabase, reportMissionSupabase } from './missions-supabase';
import type { ReportMissionCheckInPhotoResult, ReportMissionResult } from './types';

function reportMissionMemory(
  userId: string,
  missionId: string,
  submission: ValidReportSubmission,
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
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `mission-report-${crypto.randomUUID()}`,
          missionId,
          reason: submission.reason,
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
  submission: ValidReportSubmission,
): Promise<ReportMissionResult> {
  return ctx.supabase
    ? reportMissionSupabase(ctx.supabase, ctx.userId, missionId, submission)
    : reportMissionMemory(ctx.userId, missionId, submission);
}

function reportMissionCheckInPhotoMemory(
  userId: string,
  checkInId: string,
  submission: ValidReportSubmission,
): ReportMissionCheckInPhotoResult {
  const checkInRow = getState().missionCheckIns.find(
    (checkIn) => checkIn.id === checkInId && checkIn.photoUrl !== null,
  );
  if (!checkInRow) {
    return {
      code: 'check_in_not_found',
      message: 'Check-in photo not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().missionCheckInPhotoReports.some(
    (report) => report.checkInId === checkInId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      missionCheckInPhotoReports: [
        ...current.missionCheckInPhotoReports,
        {
          checkInId,
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `mission-check-in-photo-report-${crypto.randomUUID()}`,
          reason: submission.reason,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

export async function reportMissionCheckInPhoto(
  ctx: RequestContext,
  checkInId: string,
  submission: ValidReportSubmission,
): Promise<ReportMissionCheckInPhotoResult> {
  return ctx.supabase
    ? reportMissionCheckInPhotoSupabase(ctx.supabase, ctx.userId, checkInId, submission)
    : reportMissionCheckInPhotoMemory(ctx.userId, checkInId, submission);
}

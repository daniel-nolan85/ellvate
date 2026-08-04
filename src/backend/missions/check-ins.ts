import type { RequestContext } from '@/src/backend/http';
import {
  getState,
  setState,
  type StoredMissionCheckIn,
  type StoredUser,
} from '@/src/backend/store';

import {
  listMissionCheckInsSupabase,
  reportCheckInSupabase,
} from './check-ins-supabase';
import {
  CHECK_INS_LIST_LIMIT,
  type CheckInEntry,
  type PersonRef,
  type ReportCheckInResult,
} from './types';

const userRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id, name: 'Member' };
};

const toCheckInEntry = (
  checkIn: StoredMissionCheckIn,
  users: readonly StoredUser[],
): CheckInEntry => ({
  id: checkIn.id,
  missionId: checkIn.missionId,
  user: userRef(users, checkIn.userId),
  stopIndex: checkIn.stopIndex,
  completedAt: checkIn.completedAt,
  photoUrl: checkIn.photoUrl,
});

function listMissionCheckInsMemory(missionId: string): readonly CheckInEntry[] {
  const state = getState();
  return state.missionCheckIns
    .filter((checkIn) => checkIn.missionId === missionId)
    .slice()
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
    .slice(-CHECK_INS_LIST_LIMIT)
    .map((checkIn) => toCheckInEntry(checkIn, state.users));
}

function reportCheckInMemory(
  userId: string,
  checkInId: string,
): ReportCheckInResult {
  if (!getState().missionCheckIns.some((checkIn) => checkIn.id === checkInId)) {
    return {
      code: 'check_in_not_found',
      message: 'Check-in not found.',
      ok: false,
    };
  }

  const alreadyReported = getState().missionCheckInReports.some(
    (report) => report.checkInId === checkInId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      missionCheckInReports: [
        ...current.missionCheckInReports,
        {
          createdAt: new Date().toISOString(),
          id: `mission-check-in-report-${crypto.randomUUID()}`,
          checkInId,
          reporterId: userId,
        },
      ],
    }));
  }

  return { ok: true, reported: true };
}

export async function listMissionCheckIns(
  ctx: RequestContext,
  missionId: string,
): Promise<readonly CheckInEntry[]> {
  return ctx.supabase
    ? listMissionCheckInsSupabase(ctx.supabase, missionId)
    : listMissionCheckInsMemory(missionId);
}

export async function reportCheckIn(
  ctx: RequestContext,
  checkInId: string,
): Promise<ReportCheckInResult> {
  return ctx.supabase
    ? reportCheckInSupabase(ctx.supabase, ctx.userId, checkInId)
    : reportCheckInMemory(ctx.userId, checkInId);
}

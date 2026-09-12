import type { RequestContext } from '@/src/backend/http';
import {
  ensureUser,
  getState,
  setState,
  type StoredMissionCheckIn,
} from '@/src/backend/store';
import { recordXpLedgerEntry } from '@/src/backend/xp';

import { getUserMissionEntry, resolveMissionStatus, toAuthorRef } from './mission-view';
import { checkInSupabase } from './missions-supabase';
import type { CheckInResult, Mission } from './types';
import { buildUserProgress } from './user-progress';

async function checkInMemory(
  userId: string,
  missionId: string,
): Promise<CheckInResult> {
  ensureUser(userId);
  const mission = getState().missions.find((item) => item.id === missionId);

  if (!mission) {
    return {
      ok: false,
      status: 404,
      code: 'mission_not_found',
      message: 'Mission not found.',
    };
  }

  const entry = getUserMissionEntry(mission, userId);
  const status = resolveMissionStatus(mission, entry);

  if (status === 'done') {
    return {
      ok: false,
      status: 409,
      code: 'mission_complete',
      message: 'Mission is already complete.',
    };
  }

  const stopsDone = entry.stopsDone + 1;
  const completed = stopsDone >= mission.stopsTotal;
  const awardedXp = completed ? mission.xp : 0;

  // WHY: no photo/face-detection gate -- a good-faith honor system instead.
  // An "is a face present" check was trivially beaten by any photo of any
  // face, so it wasn't buying real deterrence, and pulled in a multi-MB
  // dependency that blew out every mission-route bundle. The UI carries the
  // honesty message instead.
  const nowIso = new Date().toISOString();
  const checkInRow: StoredMissionCheckIn = {
    id: `check-in-${crypto.randomUUID()}`,
    missionId,
    userId,
    stopIndex: entry.stopsDone,
    completedAt: nowIso,
  };

  const next = setState((state) => ({
    ...state,
    missionCheckIns: [...state.missionCheckIns, checkInRow],
    missions: state.missions.map((item) =>
      item.id === missionId
        ? {
            ...item,
            progressByUser: {
              ...item.progressByUser,
              [userId]: {
                completedAt: completed ? nowIso : (entry.completedAt ?? null),
                status: completed ? ('done' as const) : ('active' as const),
                stopsDone,
              },
            },
          }
        : item,
    ),
    users: completed
      ? state.users.map((user) =>
          user.id === userId
            ? {
                ...user,
                xp: user.xp + mission.xp,
                missionsCompleted: user.missionsCompleted + 1,
              }
            : user,
        )
      : state.users,
  }));

  const updatedMission = next.missions.find((item) => item.id === missionId);
  const allProgress = Object.values(updatedMission?.progressByUser ?? {});

  const missionView: Mission = {
    id: mission.id,
    author: toAuthorRef(next.users, mission.authorId),
    title: mission.title,
    description: mission.description,
    scheduledFor: mission.scheduledFor,
    xp: mission.xp,
    status: completed ? 'done' : 'active',
    accepted: true,
    stopsDone,
    stopsTotal: mission.stopsTotal,
    stops: mission.stops,
    theme: mission.theme,
    media: mission.media,
    editedAt: mission.editedAt,
    acceptedCount: allProgress.length,
    completedCount: allProgress.filter((p) => p.status === 'done').length,
  };

  return {
    ok: true,
    body: {
      mission: missionView,
      awardedXp,
      progress: buildUserProgress(
        next.users.find((user) => user.id === userId),
      ),
    },
  };
}

export async function checkIn(
  ctx: RequestContext,
  missionId: string,
): Promise<CheckInResult> {
  const result = ctx.supabase
    ? await checkInSupabase(ctx.supabase, ctx.userId, missionId)
    : await checkInMemory(ctx.userId, missionId);

  if (result.ok && result.body.awardedXp > 0) {
    await recordXpLedgerEntry(ctx, {
      amount: result.body.awardedXp,
      reason: 'mission_completed',
      refId: missionId,
    });
  }

  return result;
}


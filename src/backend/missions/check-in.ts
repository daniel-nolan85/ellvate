import { extractCheckInPhoto } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import {
  ensureUser,
  getState,
  setState,
  type StoredMissionCheckIn,
} from '@/src/backend/store';

import { getUserMissionEntry, resolveMissionStatus, toAuthorRef } from './mission-view';
import { checkInSupabase } from './missions-supabase';
import type { CheckInResult, Mission } from './types';
import { buildUserProgress } from './user-progress';

function checkInMemory(
  userId: string,
  missionId: string,
  input: unknown,
): CheckInResult {
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
  const photo = extractCheckInPhoto(input);

  // WHY: the check-in that completes the mission is the one that actually
  // proves you did it — required there, optional on earlier stops so the
  // deterrent lands where it matters without adding friction to every stop.
  if (completed && !photo) {
    return {
      ok: false,
      status: 400,
      code: 'photo_required',
      message: 'A photo is required to complete this mission.',
    };
  }

  const nowIso = new Date().toISOString();
  const checkInRow: StoredMissionCheckIn = {
    id: `check-in-${crypto.randomUUID()}`,
    missionId,
    userId,
    stopIndex: entry.stopsDone,
    completedAt: nowIso,
    photoUrl: photo ? photo.dataUrl : null,
  };

  // WHY: streaks are intentionally naive for the demo store — +1 day per
  // completing check-in, no calendar tracking. Documented in the API contract.
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
                streakDays: user.streakDays + 1,
              }
            : user,
        )
      : state.users,
  }));

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
  input: unknown = null,
): Promise<CheckInResult> {
  return ctx.supabase
    ? checkInSupabase(ctx.supabase, ctx.userId, missionId, input)
    : checkInMemory(ctx.userId, missionId, input);
}

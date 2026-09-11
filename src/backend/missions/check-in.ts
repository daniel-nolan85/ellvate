import { extractCheckInPhoto } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import {
  ensureUser,
  getState,
  setState,
  type StoredMissionCheckIn,
} from '@/src/backend/store';
import { detectFace } from '@/src/services/face-detection';

import { getUserMissionEntry, resolveMissionStatus, toAuthorRef } from './mission-view';
import { checkInSupabase } from './missions-supabase';
import type { CheckInResult, Mission } from './types';
import { buildUserProgress } from './user-progress';

async function checkInMemory(
  userId: string,
  missionId: string,
  input: unknown,
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

  // WHY: a hard automated gate, not a soft flag-for-review -- there's no
  // review queue for this because the photo is never kept around to review
  // (see below). Scanned in memory and immediately discarded either way, so
  // a rejection here costs the user nothing but a retry with a different
  // photo.
  if (completed && photo) {
    const outcome = await detectFace(photo.dataUrl);
    if (outcome === 'no_face_detected') {
      return {
        ok: false,
        status: 400,
        code: 'no_face_detected',
        message: "We couldn't spot a person in that photo. Try a different one.",
      };
    }
    if (outcome === 'undecodable_image') {
      return {
        ok: false,
        status: 400,
        code: 'unreadable_photo',
        message: "We couldn't read that photo. Try a different one.",
      };
    }
  }

  // WHY: never persisted -- these photos are scanned for a face and
  // discarded, never displayed to anyone (including admins), so there's
  // nothing to keep a URL for.
  const nowIso = new Date().toISOString();
  const checkInRow: StoredMissionCheckIn = {
    id: `check-in-${crypto.randomUUID()}`,
    missionId,
    userId,
    stopIndex: entry.stopsDone,
    completedAt: nowIso,
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
  input: unknown = null,
): Promise<CheckInResult> {
  return ctx.supabase
    ? checkInSupabase(ctx.supabase, ctx.userId, missionId, input)
    : checkInMemory(ctx.userId, missionId, input);
}


import { extractCheckInPhoto } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import {
  ensureUser,
  getState,
  setState,
  type StoredMissionCheckIn,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { recordXpLedgerEntry } from '@/src/backend/xp';

import { getUserMissionEntry, resolveMissionStatus, toAuthorRef } from './mission-view';
import { checkInSupabase, listMissionCheckInPhotosSupabase } from './missions-supabase';
import type { CheckInResult, Mission, MissionCheckInPhotosPage } from './types';
import { buildUserProgress } from './user-progress';

export const DEFAULT_CHECK_IN_PHOTOS_PAGE_SIZE = 20;
export const MAX_CHECK_IN_PHOTOS_PAGE_SIZE = 50;

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

  // WHY: no photo/face-detection gate -- a good-faith honor system instead.
  // An "is a face present" check was trivially beaten by any photo of any
  // face, so it wasn't buying real deterrence, and pulled in a multi-MB
  // dependency that blew out every mission-route bundle. The UI carries the
  // honesty message instead. A photo is entirely optional here -- attaching
  // one is a fun add-on to the gallery, never a requirement to complete.
  const photoUpload = extractCheckInPhoto(input);
  const nowIso = new Date().toISOString();
  const checkInRow: StoredMissionCheckIn = {
    id: `check-in-${crypto.randomUUID()}`,
    missionId,
    userId,
    stopIndex: entry.stopsDone,
    completedAt: nowIso,
    photoUrl: photoUpload?.dataUrl ?? null,
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
  input?: unknown,
): Promise<CheckInResult> {
  const result = ctx.supabase
    ? await checkInSupabase(ctx.supabase, ctx.userId, missionId, input)
    : await checkInMemory(ctx.userId, missionId, input);

  if (result.ok && result.body.awardedXp > 0) {
    await recordXpLedgerEntry(ctx, {
      amount: result.body.awardedXp,
      reason: 'mission_completed',
      refId: missionId,
    });
  }

  return result;
}

// Newest-first, mirroring a social feed rather than the comment thread's
// oldest-first reading order -- there's no "conversation" to read in order
// here, just a gallery of everyone's optional check-in photos. Muted authors
// are filtered out, same as every other list of user-generated content.
function listMissionCheckInPhotosMemory(
  userId: string,
  missionId: string,
  limit: number,
  cursor: string | null,
): MissionCheckInPhotosPage {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const wrapped = state.missionCheckIns
    .filter(
      (checkInRow) =>
        checkInRow.missionId === missionId &&
        checkInRow.photoUrl !== null &&
        !mutedUserIds.has(checkInRow.userId),
    )
    .map((checkInRow) => ({
      checkInRow,
      id: checkInRow.id,
      sortKey: checkInRow.completedAt,
    }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    nextCursor: page.nextCursor,
    photos: page.items.map(({ checkInRow }) => ({
      author: toAuthorRef(state.users, checkInRow.userId),
      completedAt: checkInRow.completedAt,
      id: checkInRow.id,
      missionId: checkInRow.missionId,
      // Non-null by the filter above -- TypeScript can't see through
      // `.filter()`, so this is a plain assertion, not a runtime check.
      photoUrl: checkInRow.photoUrl as string,
      stopIndex: checkInRow.stopIndex,
    })),
  };
}

export async function listMissionCheckInPhotos(
  ctx: RequestContext,
  missionId: string,
  options?: { readonly limit?: number; readonly cursor?: string | null },
): Promise<MissionCheckInPhotosPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_CHECK_IN_PHOTOS_PAGE_SIZE),
    MAX_CHECK_IN_PHOTOS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listMissionCheckInPhotosSupabase(ctx.supabase, ctx.userId, missionId, limit, cursor)
    : listMissionCheckInPhotosMemory(ctx.userId, missionId, limit, cursor);
}


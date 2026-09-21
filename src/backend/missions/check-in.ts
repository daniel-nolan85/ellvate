import { extractCheckInPhoto } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { createNotificationMemory } from '@/src/backend/notifications';
import {
  ensureUser,
  getState,
  setState,
  type StoredMissionCheckIn,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { computeProgress } from '@/src/backend/progress';
import { recordXpLedgerEntry } from '@/src/backend/xp';

import {
  completedStopIndicesFor,
  getUserMissionEntry,
  resolveMissionStatus,
  toAuthorRef,
} from './mission-view';
import {
  checkInSupabase,
  getMyCheckInPhotoSupabase,
  listMissionCheckInPhotosSupabase,
  toggleCheckInPhotoLikeSupabase,
  updateMyCheckInPhotoSupabase,
} from './missions-supabase';
import type {
  CheckInResult,
  LikeCheckInPhotoResult,
  Mission,
  MissionCheckInPhotosPage,
  MyCheckInPhotoResult,
} from './types';
import { parseStopIndex } from './validation';
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

  // Derived from actual check-in rows, used only to pick/validate a stop
  // index (below) and to report completedStopIndices in the response --
  // entry.stopsDone (progressByUser's own counter) stays the source of
  // truth for the count and mission-complete decision, unchanged from
  // before, since a handful of seed fixtures set that counter directly
  // without inserting matching check-in rows.
  const completedIndices = completedStopIndicesFor(
    getState().missionCheckIns,
    missionId,
    userId,
  );
  const completedSet = new Set(completedIndices);

  // Omitted -- default to the lowest not-yet-completed stop, preserving the
  // old always-sequential behavior for any caller that doesn't specify one
  // (existing tests, and the "check in whatever's next" case). Provided --
  // any stop can be checked into, in any order; only its own completion
  // state (not stops before it) is validated.
  const requestedStopIndex = parseStopIndex(input);
  let stopIndex: number;
  if (requestedStopIndex === undefined) {
    stopIndex = 0;
    while (completedSet.has(stopIndex)) {
      stopIndex += 1;
    }
  } else if (
    requestedStopIndex === null ||
    requestedStopIndex < 0 ||
    requestedStopIndex >= mission.stopsTotal
  ) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_stop_index',
      message: 'That stop doesn’t exist on this mission.',
    };
  } else if (completedSet.has(requestedStopIndex)) {
    return {
      ok: false,
      status: 409,
      code: 'stop_already_complete',
      message: 'You’ve already checked into this stop.',
    };
  } else {
    stopIndex = requestedStopIndex;
  }

  const stopsDone = entry.stopsDone + 1;
  const completed = stopsDone >= mission.stopsTotal;
  const awardedXp = completed ? mission.xp : 0;
  const previousXp = getState().users.find((user) => user.id === userId)?.xp ?? 0;
  const previousLevel = computeProgress(previousXp).level;

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
    stopIndex,
    completedAt: nowIso,
    photoUrl: photoUpload?.dataUrl ?? null,
    likes: 0,
    likedBy: [],
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
    completedStopIndices: [...completedIndices, stopIndex].sort((a, b) => a - b),
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
      previousLevel,
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
  // Supabase: checkInSupabase grants the xp and its ledger entry together
  // via grant_xp_and_log, atomically -- see that function's own WHY. Only
  // the memory backend still needs the ledger entry recorded separately
  // here, since its xp bump happens inline in checkInMemory above.
  if (ctx.supabase) {
    return checkInSupabase(ctx.supabase, ctx.userId, missionId, input);
  }

  const result = await checkInMemory(ctx.userId, missionId, input);
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
      liked: checkInRow.likedBy.includes(userId),
      likes: checkInRow.likes,
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

// The check-in that actually finished the mission for this user -- the most
// recently completed row, since stops can now be checked into in any order
// (the highest stopIndex is no longer necessarily the last one recorded).
// Editing a photo only ever targets this one row, not every stop's check-in,
// mirroring how the UI shows a single "your check-in photo" slot on a
// completed mission rather than a per-stop gallery.
function findCompletingCheckIn(
  userId: string,
  missionId: string,
): StoredMissionCheckIn | undefined {
  return getState().missionCheckIns
    .filter((row) => row.missionId === missionId && row.userId === userId)
    .reduce<StoredMissionCheckIn | undefined>(
      (latest, row) => (!latest || row.completedAt > latest.completedAt ? row : latest),
      undefined,
    );
}

function getMyCheckInPhotoMemory(userId: string, missionId: string): MyCheckInPhotoResult {
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
  if (resolveMissionStatus(mission, entry) !== 'done') {
    return {
      ok: false,
      status: 409,
      code: 'not_completed',
      message: 'You haven’t completed this mission yet.',
    };
  }
  const checkInRow = findCompletingCheckIn(userId, missionId);
  return { ok: true, body: { photoUrl: checkInRow?.photoUrl ?? null } };
}

function updateMyCheckInPhotoMemory(
  userId: string,
  missionId: string,
  input: unknown,
): MyCheckInPhotoResult {
  ensureUser(userId);
  const existing = getMyCheckInPhotoMemory(userId, missionId);
  if (!existing.ok) {
    return existing;
  }
  const checkInRow = findCompletingCheckIn(userId, missionId);
  if (!checkInRow) {
    return { ok: true, body: { photoUrl: null } };
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const nextPhotoUrl = raw.removePhoto === true
    ? null
    : (extractCheckInPhoto(input)?.dataUrl ?? checkInRow.photoUrl);

  setState((state) => ({
    ...state,
    missionCheckIns: state.missionCheckIns.map((row) =>
      row.id === checkInRow.id ? { ...row, photoUrl: nextPhotoUrl } : row,
    ),
  }));

  return { ok: true, body: { photoUrl: nextPhotoUrl } };
}

export async function getMyCheckInPhoto(
  ctx: RequestContext,
  missionId: string,
): Promise<MyCheckInPhotoResult> {
  return ctx.supabase
    ? getMyCheckInPhotoSupabase(ctx.supabase, ctx.userId, missionId)
    : getMyCheckInPhotoMemory(ctx.userId, missionId);
}

export async function updateMyCheckInPhoto(
  ctx: RequestContext,
  missionId: string,
  input: unknown,
): Promise<MyCheckInPhotoResult> {
  return ctx.supabase
    ? updateMyCheckInPhotoSupabase(ctx.supabase, ctx.userId, missionId, input)
    : updateMyCheckInPhotoMemory(ctx.userId, missionId, input);
}

// Mirrors toggleLikeMemory (forum/posts.ts) exactly -- same optimistic
// like/unlike-by-membership shape, same "notify on new like, never on
// unlike or self-like" rule.
function toggleCheckInPhotoLikeMemory(
  userId: string,
  checkInId: string,
): LikeCheckInPhotoResult | null {
  const existing = getState().missionCheckIns.find((row) => row.id === checkInId);
  if (!existing || existing.photoUrl === null) {
    return null;
  }
  const wasLiked = existing.likedBy.includes(userId);
  const likes = Math.max(0, existing.likes + (wasLiked ? -1 : 1));
  const likedBy = wasLiked
    ? existing.likedBy.filter((id) => id !== userId)
    : [...existing.likedBy, userId];
  setState((current) => ({
    ...current,
    missionCheckIns: current.missionCheckIns.map((row) =>
      row.id === checkInId ? { ...row, likedBy, likes } : row,
    ),
  }));
  if (!wasLiked && existing.userId !== userId) {
    const liker = getState().users.find((candidate) => candidate.id === userId);
    createNotificationMemory(
      existing.userId,
      'like',
      'New like on your check-in photo',
      `${liker?.name ?? 'Someone'} liked your check-in photo`,
      { missionId: existing.missionId },
    );
  }
  return { id: checkInId, liked: !wasLiked, likes };
}

export async function toggleCheckInPhotoLike(
  ctx: RequestContext,
  checkInId: string,
): Promise<LikeCheckInPhotoResult | null> {
  return ctx.supabase
    ? toggleCheckInPhotoLikeSupabase(ctx.supabase, ctx.userId, checkInId)
    : toggleCheckInPhotoLikeMemory(ctx.userId, checkInId);
}


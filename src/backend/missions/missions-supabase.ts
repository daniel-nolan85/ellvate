import type { SupabaseClient } from '@supabase/supabase-js';

import {
  extractCheckInPhoto,
  extractExistingMedia,
  extractMediaUploads,
} from '@/src/backend/media';
import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';
import { removeStorageObjects, uploadDataUrl } from '@/src/services/storage';

import { defaultDisplayName, type MissionStatus, type MissionTheme } from '@/src/backend/store';

import type {
  AcceptMissionResult,
  CheckInResult,
  CreateMissionResult,
  Mission,
  MissionFilter,
  MissionMedia,
  MissionsPage,
  MissionsView,
  MyMissionsPage,
  ReportMissionResult,
  UpdateMissionResult,
  UserProgress,
} from './types';
import { buildProgress, DEFAULT_PROGRESS_TITLE } from './user-progress';
import { validateMissionInput } from './validation';

const MISSION_SELECT =
  'id,created_by,title,description,scheduled_for,xp,stops_total,stops,theme,media,position,edited_at';

interface MissionRow {
  readonly id: string;
  readonly created_by: string;
  readonly title: string;
  readonly description: string;
  readonly scheduled_for: string | null;
  readonly xp: number;
  readonly stops_total: number;
  readonly stops: readonly string[] | null;
  readonly theme: string;
  readonly media: readonly MissionMedia[] | null;
  readonly position: number;
  readonly edited_at: string | null;
}

interface ProgressRow {
  readonly mission_id: string;
  readonly stops_done: number;
  readonly status: MissionStatus;
}

interface UserRow {
  readonly xp: number;
  readonly streak_days: number;
  readonly missions_completed: number;
  readonly title: string;
}

type UploadMissionMediaResult =
  | { readonly ok: true; readonly media: readonly MissionMedia[] }
  | { readonly ok: false; readonly uploaded: readonly MissionMedia[] };

const resolveStatus = (stopsDone: number, stopsTotal: number): MissionStatus =>
  stopsDone >= stopsTotal ? 'done' : 'active';

interface PersonLookup {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

const toMissionView = (
  row: MissionRow,
  entry: ProgressRow | undefined,
  nameById: ReadonlyMap<string, PersonLookup>,
): Mission => {
  const stopsDone = entry?.stops_done ?? 0;
  const author = nameById.get(row.created_by);
  return {
    id: row.id,
    author: {
      avatarUrl: author?.avatarUrl ?? null,
      id: row.created_by,
      isAdmin: author?.isAdmin ?? false,
      name: author?.name ?? 'Member',
    },
    title: row.title,
    description: row.description,
    scheduledFor: row.scheduled_for,
    xp: row.xp,
    status: resolveStatus(stopsDone, row.stops_total),
    accepted: entry !== undefined,
    stopsDone,
    stopsTotal: row.stops_total,
    stops: row.stops ?? [],
    theme: row.theme as MissionTheme,
    media: row.media ?? undefined,
    editedAt: row.edited_at,
  };
};

// Looks up a single user's display name for use in toMissionView's nameById
// map, used after create/update where only the acting user's name is needed.
const nameMapFor = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<ReadonlyMap<string, PersonLookup>> => {
  const { data, error } = await supabase
    .from('app_users')
    .select('id,name,avatar_url,is_admin')
    .eq('id', userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'load mission author');
  return new Map(
    data
      ? [
          [
            data.id as string,
            {
              avatarUrl: (data.avatar_url as string | null) ?? null,
              isAdmin: Boolean(data.is_admin),
              name: data.name as string,
            },
          ],
        ]
      : [],
  );
};

// Uploads each picked image to Supabase Storage under the mission's own id.
// WHY: a failed upload is surfaced as `ok: false` (with whatever succeeded so
// far in `uploaded`) rather than silently dropped — publishing a mission
// that's missing images the user picked would misrepresent what got saved.
const uploadMissionMedia = async (
  supabase: SupabaseClient,
  missionId: string,
  input: unknown,
): Promise<UploadMissionMediaResult> => {
  const uploads = extractMediaUploads(input);
  if (uploads.length === 0) {
    return { media: [], ok: true };
  }
  const results = await Promise.all(
    uploads.map(async (upload) => {
      const url = await uploadDataUrl(
        supabase,
        upload.dataUrl,
        upload.filename,
        'missions',
        missionId,
      );
      return url ? { filename: upload.filename, url } : null;
    }),
  );
  const succeeded = results.filter(
    (media): media is MissionMedia => media !== null,
  );
  if (succeeded.length !== results.length) {
    return { ok: false, uploaded: succeeded };
  }
  return { media: succeeded, ok: true };
};

const MEDIA_UPLOAD_FAILED_MESSAGE =
  'One or more images failed to upload. Please try again.';

// A real Clerk user has no app_users row yet; create it before any owned write
// so foreign keys resolve. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = defaultDisplayName(userId),
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure mission user');
};

const loadUserRow = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRow | null> => {
  const { data, error } = await supabase
    .from('app_users')
    .select('xp,streak_days,missions_completed,title')
    .eq('id', userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'load mission user');
  return (data as UserRow | null) ?? null;
};

export async function getMissionsViewSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<MissionsView> {
  const { data, error } = await supabase
    .from('missions')
    .select(MISSION_SELECT)
    .order('position', { ascending: true });
  throwIfSupabaseError(error, 'load missions');
  const missionRows = (data ?? []) as unknown as MissionRow[];

  const { data: progressData, error: progressError } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('user_id', userId);
  throwIfSupabaseError(progressError, 'load mission progress');
  const progressByMission = new Map(
    ((progressData ?? []) as unknown as ProgressRow[]).map((row) => [
      row.mission_id,
      row,
    ]),
  );

  const userRow = await loadUserRow(supabase, userId);

  const authorIds = [...new Set(missionRows.map((row) => row.created_by))];
  const { data: authorRows, error: authorError } = await supabase
    .from('app_users')
    .select('id,name,avatar_url,is_admin')
    .in('id', authorIds);
  throwIfSupabaseError(authorError, 'load mission authors');
  const nameById: ReadonlyMap<string, PersonLookup> = new Map(
    (authorRows ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        isAdmin: Boolean(row.is_admin),
        name: row.name as string,
      },
    ]),
  );

  return {
    missions: missionRows.map((row) =>
      toMissionView(row, progressByMission.get(row.id), nameById),
    ),
    progress: buildProgress({
      xp: userRow?.xp ?? 0,
      streakDays: userRow?.streak_days ?? 0,
      missionsCompleted: userRow?.missions_completed ?? 0,
      title: userRow?.title ?? DEFAULT_PROGRESS_TITLE,
    }),
  };
}

const matchesMissionFilter = (mission: Mission, filter: MissionFilter): boolean => {
  switch (filter) {
    case 'available':
      return !mission.accepted && mission.status === 'active';
    case 'in-progress':
      return mission.accepted && mission.status === 'active';
    case 'completed':
      return mission.status === 'done';
  }
};

// The paginated, filtered counterpart to getMissionsViewSupabase, mirroring
// getMyMissionsViewSupabase's precedent below: "created by me OR completed by
// me" (and here, the status-bucket filter) can't be expressed as a single
// keyset-limited SQL query since it depends on a computed join against
// mission_progress, so this fetches the same 3 queries getMissionsViewSupabase
// already runs, filters/maps in application code, then paginates the result.
// The browse order has always been oldest-first (array/position order); since
// paginateInMemory always sorts descending by sortKey, the sortKey is
// inverted here to preserve that instead of silently flipping to newest-first.
const MAX_MISSION_POSITION = 9_999_999;

export async function listMissionsPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  filter: MissionFilter,
  limit: number,
  cursor: string | null,
): Promise<MissionsPage> {
  const [{ data, error }, mutedUserIds] = await Promise.all([
    supabase
      .from('missions')
      .select(MISSION_SELECT)
      .order('position', { ascending: true }),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load missions');
  const mutedSet = new Set(mutedUserIds);
  const missionRows = ((data ?? []) as unknown as MissionRow[]).filter(
    (row) => !mutedSet.has(row.created_by),
  );

  const { data: progressData, error: progressError } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('user_id', userId);
  throwIfSupabaseError(progressError, 'load mission progress');
  const progressByMission = new Map(
    ((progressData ?? []) as unknown as ProgressRow[]).map((row) => [
      row.mission_id,
      row,
    ]),
  );

  const authorIds = [...new Set(missionRows.map((row) => row.created_by))];
  const { data: authorRows, error: authorError } = authorIds.length
    ? await supabase.from('app_users').select('id,name,avatar_url,is_admin').in('id', authorIds)
    : { data: [], error: null };
  throwIfSupabaseError(authorError, 'load mission authors');
  const nameById: ReadonlyMap<string, PersonLookup> = new Map(
    (authorRows ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        isAdmin: Boolean(row.is_admin),
        name: row.name as string,
      },
    ]),
  );

  const filtered = missionRows
    .map((row, index) => ({
      index,
      view: toMissionView(row, progressByMission.get(row.id), nameById),
    }))
    .filter(({ view }) => matchesMissionFilter(view, filter))
    .map(({ index, view }) => ({
      id: view.id,
      sortKey: String(MAX_MISSION_POSITION - index).padStart(7, '0'),
      view,
    }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    missions: page.items.map((item) => item.view),
    nextCursor: page.nextCursor,
  };
}

export async function getUserProgressSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProgress> {
  const userRow = await loadUserRow(supabase, userId);
  return buildProgress({
    xp: userRow?.xp ?? 0,
    streakDays: userRow?.streak_days ?? 0,
    missionsCompleted: userRow?.missions_completed ?? 0,
    title: userRow?.title ?? DEFAULT_PROGRESS_TITLE,
  });
}

// Scoped to missions the caller created or completed — bounded by one user's
// own activity rather than the whole community's mission list (unlike
// getMissionsViewSupabase, which every screen but the activity hub needs).
// "created by me" OR "completed by me" can't be expressed as a single
// keyset-limited query, so this fetches both (each bounded by the caller's
// own row count, not the community's) and paginates the merged result.
export async function getMyMissionsViewSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
): Promise<MyMissionsPage> {
  const [createdRes, myProgressRes] = await Promise.all([
    supabase.from('missions').select(MISSION_SELECT).eq('created_by', userId),
    supabase
      .from('mission_progress')
      .select('mission_id,stops_done,status')
      .eq('user_id', userId),
  ]);
  throwIfSupabaseError(createdRes.error, 'load my missions');
  throwIfSupabaseError(myProgressRes.error, 'load my mission progress');

  const createdRows = (createdRes.data ?? []) as unknown as MissionRow[];
  const myProgress = (myProgressRes.data ?? []) as unknown as ProgressRow[];
  const completedIds = new Set(
    myProgress
      .filter((row) => row.status === 'done')
      .map((row) => row.mission_id),
  );
  const createdIds = new Set(createdRows.map((row) => row.id));
  const idsToFetch = [...completedIds].filter((id) => !createdIds.has(id));

  let completedRows: readonly MissionRow[] = [];
  if (idsToFetch.length > 0) {
    const { data, error } = await supabase
      .from('missions')
      .select(MISSION_SELECT)
      .in('id', idsToFetch);
    throwIfSupabaseError(error, 'load completed missions');
    completedRows = (data ?? []) as unknown as MissionRow[];
  }

  const missionRows = [...createdRows, ...completedRows];
  const progressByMission = new Map(myProgress.map((row) => [row.mission_id, row]));

  const authorIds = [...new Set(missionRows.map((row) => row.created_by))];
  const { data: authorRows, error: authorError } = authorIds.length
    ? await supabase.from('app_users').select('id,name,avatar_url,is_admin').in('id', authorIds)
    : { data: [], error: null };
  throwIfSupabaseError(authorError, 'load my mission authors');
  const nameById: ReadonlyMap<string, PersonLookup> = new Map(
    (authorRows ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        isAdmin: Boolean(row.is_admin),
        name: row.name as string,
      },
    ]),
  );

  const wrapped = missionRows.map((row) => ({
    id: row.id,
    row,
    sortKey: String(row.position).padStart(10, '0'),
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    missions: page.items.map((item) =>
      toMissionView(item.row, progressByMission.get(item.row.id), nameById),
    ),
    nextCursor: page.nextCursor,
  };
}

// Fetches specific missions by id — used to hydrate bookmarks, which can
// point at any mission regardless of authorship or completion status.
export async function getMissionsByIdsSupabase(
  supabase: SupabaseClient,
  userId: string,
  ids: readonly string[],
): Promise<readonly Mission[]> {
  const { data, error } = await supabase.from('missions').select(MISSION_SELECT).in('id', ids);
  throwIfSupabaseError(error, 'load missions by id');
  const missionRows = (data ?? []) as unknown as MissionRow[];

  const { data: progressData, error: progressError } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('user_id', userId)
    .in('mission_id', ids);
  throwIfSupabaseError(progressError, 'load bookmarked mission progress');
  const progressByMission = new Map(
    ((progressData ?? []) as unknown as ProgressRow[]).map((row) => [row.mission_id, row]),
  );

  const authorIds = [...new Set(missionRows.map((row) => row.created_by))];
  const { data: authorRows, error: authorError } = authorIds.length
    ? await supabase.from('app_users').select('id,name,avatar_url,is_admin').in('id', authorIds)
    : { data: [], error: null };
  throwIfSupabaseError(authorError, 'load bookmarked mission authors');
  const nameById: ReadonlyMap<string, PersonLookup> = new Map(
    (authorRows ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        isAdmin: Boolean(row.is_admin),
        name: row.name as string,
      },
    ]),
  );

  return missionRows.map((row) =>
    toMissionView(row, progressByMission.get(row.id), nameById),
  );
}

export async function createMissionSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<CreateMissionResult> {
  const validation = validateMissionInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  await ensureUser(supabase, userId);

  const { data: lastRow, error: lastRowError } = await supabase
    .from('missions')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfSupabaseError(lastRowError, 'load mission position');
  const position = ((lastRow as { position: number } | null)?.position ?? -1) + 1;

  const missionId = `msn-${crypto.randomUUID()}`;
  const { data: inserted, error: insertError } = await supabase
    .from('missions')
    .insert({
      id: missionId,
      created_by: userId,
      title: value.title,
      description: value.description,
      scheduled_for: value.scheduledFor,
      xp: value.xp,
      stops_total: value.stopsTotal,
      stops: value.stops,
      theme: value.theme,
      position,
    })
    .select(MISSION_SELECT)
    .single();
  throwIfSupabaseError(insertError, 'create mission');
  if (!inserted) {
    throw new Error('create mission: database returned no mission.');
  }
  const insertedRow = inserted as unknown as MissionRow;
  const nameById = await nameMapFor(supabase, userId);

  const mediaResult = await uploadMissionMedia(supabase, missionId, input);
  if (!mediaResult.ok) {
    await removeStorageObjects(
      supabase,
      mediaResult.uploaded.map((media) => media.url),
    );
    await supabase.from('missions').delete().eq('id', missionId);
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  if (mediaResult.media.length === 0) {
    return { ok: true, mission: toMissionView(insertedRow, undefined, nameById) };
  }

  const { data: updated, error: updateError } = await supabase
    .from('missions')
    .update({ media: mediaResult.media })
    .eq('id', missionId)
    .select(MISSION_SELECT)
    .single();
  throwIfSupabaseError(updateError, 'attach mission media');
  return {
    ok: true,
    mission: toMissionView(
      (updated as unknown as MissionRow) ?? insertedRow,
      undefined,
      nameById,
    ),
  };
}

export async function updateMissionSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  input: unknown,
): Promise<UpdateMissionResult> {
  const { data: existing, error: existingError } = await supabase
    .from('missions')
    .select('id,created_by,media')
    .eq('id', missionId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load mission');
  if (!existing) {
    return {
      code: 'mission_not_found',
      message: 'Mission not found.',
      ok: false,
    };
  }
  if (existing.created_by !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own missions.',
      ok: false,
    };
  }
  const validation = validateMissionInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const keptMedia = extractExistingMedia(input);
  const uploadResult = await uploadMissionMedia(supabase, missionId, input);
  if (!uploadResult.ok) {
    await removeStorageObjects(
      supabase,
      uploadResult.uploaded.map((media) => media.url),
    );
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  const media = [...keptMedia, ...uploadResult.media];

  const { data, error } = await supabase
    .from('missions')
    .update({
      title: value.title,
      description: value.description,
      scheduled_for: value.scheduledFor,
      xp: value.xp,
      stops_total: value.stopsTotal,
      stops: value.stops,
      theme: value.theme,
      media: media.length ? media : null,
      edited_at: new Date().toISOString(),
    })
    .eq('id', missionId)
    .select(MISSION_SELECT)
    .single();
  throwIfSupabaseError(error, 'update mission');
  if (!data) {
    throw new Error('update mission: database returned no mission.');
  }

  const previousMedia =
    (existing.media as readonly MissionMedia[] | null) ?? [];
  const keptUrls = new Set(keptMedia.map((item) => item.url));
  const removedMedia = previousMedia.filter((item) => !keptUrls.has(item.url));
  await removeStorageObjects(
    supabase,
    removedMedia.map((item) => item.url),
  );

  const row = data as unknown as MissionRow;
  const { data: entryData, error: entryError } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(entryError, 'load mission progress');
  const entry = (entryData as ProgressRow | null) ?? undefined;
  const nameById = await nameMapFor(supabase, userId);
  return {
    ok: true,
    mission: toMissionView(row, entry, nameById),
  };
}

export async function deleteMissionSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
): Promise<boolean> {
  const { data: existing, error: existingError } = await supabase
    .from('missions')
    .select('id,created_by,media')
    .eq('id', missionId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load mission');
  if (!existing || existing.created_by !== userId) {
    return false;
  }
  // WHY: clean up Storage before deleting the row — owner-scoped Storage RLS
  // (see 0007) verifies ownership by looking the mission back up, so the row
  // must still exist when the cleanup call runs.
  const media = (existing.media as readonly MissionMedia[] | null) ?? [];
  await removeStorageObjects(
    supabase,
    media.map((item) => item.url),
  );
  const { error } = await supabase.from('missions').delete().eq('id', missionId);
  throwIfSupabaseError(error, 'delete mission');
  return true;
}

export async function checkInSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  input: unknown,
): Promise<CheckInResult> {
  await ensureUser(supabase, userId);

  const { data: missionData, error: missionError } = await supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('id', missionId)
    .maybeSingle();
  throwIfSupabaseError(missionError, 'load mission');
  const mission = missionData as MissionRow | null;
  if (!mission) {
    return {
      ok: false,
      status: 404,
      code: 'mission_not_found',
      message: 'Mission not found.',
    };
  }

  const { data: entryData, error: entryError } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(entryError, 'load mission check-in');
  const entry = (entryData as ProgressRow | null) ?? undefined;

  const currentStopsDone = entry?.stops_done ?? 0;
  const status = resolveStatus(currentStopsDone, mission.stops_total);

  if (status === 'done') {
    return {
      ok: false,
      status: 409,
      code: 'mission_complete',
      message: 'Mission is already complete.',
    };
  }

  const stopsDone = currentStopsDone + 1;
  const completed = stopsDone >= mission.stops_total;
  const awardedXp = completed ? mission.xp : 0;
  const photo = extractCheckInPhoto(input);

  if (completed && !photo) {
    return {
      ok: false,
      status: 400,
      code: 'photo_required',
      message: 'A photo is required to complete this mission.',
    };
  }

  const photoUrl = photo
    ? await uploadDataUrl(supabase, photo.dataUrl, photo.filename, 'mission-checkins', userId)
    : null;

  const { error: checkInInsertError } = await supabase.from('mission_check_ins').insert({
    mission_id: missionId,
    user_id: userId,
    stop_index: currentStopsDone,
    photo_url: photoUrl,
  });
  throwIfSupabaseError(checkInInsertError, 'save mission check-in');

  const { error: progressWriteError } = await supabase.from('mission_progress').upsert(
    {
      completed_at: completed ? new Date().toISOString() : null,
      mission_id: missionId,
      user_id: userId,
      stops_done: stopsDone,
      status: completed ? 'done' : 'active',
    },
    { onConflict: 'mission_id,user_id' },
  );
  throwIfSupabaseError(progressWriteError, 'save mission progress');

  const userRow = await loadUserRow(supabase, userId);
  const baseXp = userRow?.xp ?? 0;
  const baseStreak = userRow?.streak_days ?? 0;
  const baseMissions = userRow?.missions_completed ?? 0;
  const title = userRow?.title ?? DEFAULT_PROGRESS_TITLE;

  // WHY: streaks are intentionally naive — +1 day per completing check-in, no
  // calendar tracking. Documented in the API contract and matches the memory path.
  if (completed) {
    const { error: userUpdateError } = await supabase
      .from('app_users')
      .update({
        xp: baseXp + mission.xp,
        missions_completed: baseMissions + 1,
        streak_days: baseStreak + 1,
      })
      .eq('id', userId);
    throwIfSupabaseError(userUpdateError, 'save mission user progress');
  }

  const authorNameById = await nameMapFor(supabase, mission.created_by);
  const author = authorNameById.get(mission.created_by);
  const missionView: Mission = {
    id: mission.id,
    author: {
      avatarUrl: author?.avatarUrl ?? null,
      id: mission.created_by,
      isAdmin: author?.isAdmin ?? false,
      name: author?.name ?? 'Member',
    },
    title: mission.title,
    description: mission.description,
    scheduledFor: mission.scheduled_for,
    xp: mission.xp,
    status: completed ? 'done' : 'active',
    accepted: true,
    stopsDone,
    stopsTotal: mission.stops_total,
    stops: mission.stops ?? [],
    theme: mission.theme as MissionTheme,
    media: mission.media ?? undefined,
    editedAt: mission.edited_at,
  };

  return {
    ok: true,
    body: {
      mission: missionView,
      awardedXp,
      progress: buildProgress({
        xp: completed ? baseXp + mission.xp : baseXp,
        streakDays: completed ? baseStreak + 1 : baseStreak,
        missionsCompleted: completed ? baseMissions + 1 : baseMissions,
        title,
      }),
    },
  };
}

// Creates a 0-stops mission_progress row for the user if one doesn't already
// exist — idempotent (ignoreDuplicates), since accepting twice or accepting
// a mission already in progress must never reset real progress.
export async function acceptMissionSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
): Promise<AcceptMissionResult> {
  await ensureUser(supabase, userId);

  const { data: missionData, error: missionError } = await supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('id', missionId)
    .maybeSingle();
  throwIfSupabaseError(missionError, 'load mission');
  const mission = missionData as MissionRow | null;
  if (!mission) {
    return {
      ok: false,
      status: 404,
      code: 'mission_not_found',
      message: 'Mission not found.',
    };
  }

  const { error: insertError } = await supabase.from('mission_progress').upsert(
    {
      completed_at: null,
      mission_id: missionId,
      user_id: userId,
      stops_done: 0,
      status: 'active',
    },
    { ignoreDuplicates: true, onConflict: 'mission_id,user_id' },
  );
  throwIfSupabaseError(insertError, 'accept mission');

  const { data: entryData, error: entryError } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(entryError, 'load mission progress after accept');
  const entry = (entryData as ProgressRow | null) ?? undefined;

  const nameById = await nameMapFor(supabase, mission.created_by);
  return { ok: true, mission: toMissionView(mission, entry, nameById) };
}

export async function reportMissionSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
): Promise<ReportMissionResult> {
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('id')
    .eq('id', missionId)
    .maybeSingle();
  throwIfSupabaseError(missionError, 'load reported mission');
  if (!mission) {
    return { code: 'mission_not_found', message: 'Mission not found.', ok: false };
  }

  await ensureUser(supabase, userId);
  // Idempotent: a unique (mission_id, reporter_id) constraint on
  // mission_reports means a repeat report from the same user is a silent
  // no-op, not an error.
  const { error } = await supabase
    .from('mission_reports')
    .upsert(
      { mission_id: missionId, reporter_id: userId },
      { ignoreDuplicates: true, onConflict: 'mission_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report mission');
  return { ok: true, reported: true };
}

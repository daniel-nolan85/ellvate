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

import { uploadReportEvidence, type ValidReportSubmission } from '../reports/report-submission';
import type {
  AcceptMissionResult,
  CheckInResult,
  CreateMissionResult,
  LikeCheckInPhotoResult,
  Mission,
  MissionCheckInPhotosPage,
  MissionFilter,
  MissionMedia,
  MissionsPage,
  MissionsView,
  MyCheckInPhotoResult,
  MyMissionsPage,
  ReportMissionCheckInPhotoResult,
  ReportMissionResult,
  UpdateMissionResult,
  UserProgress,
} from './types';
import { buildProgress } from './user-progress';
import { parseStopIndex, validateMissionInput } from './validation';

// The embedded `author` relation (same pattern already used by posts,
// comments, petitions, etc. -- see e.g. posts-supabase.ts's POST_SELECT)
// folds what used to be a separate `app_users` lookup into this same
// request via PostgREST's foreign-table join, instead of firing it as its
// own follow-up query. Each of those follow-up queries counted as its own
// subrequest against the hosting platform's per-request subrequest cap, and
// with several of them firing in parallel per screen (missions, progress,
// authors, activity counts, ...) real requests were hitting that cap --
// "Too many subrequests by single Worker invocation" in the deployment
// logs, surfacing to users as a generic 503 on member profiles and other
// screens that route through this module.
const MISSION_SELECT =
  'id,created_by,title,description,scheduled_for,xp,stops_total,stops,theme,media,position,edited_at,author:app_users!missions_created_by_fkey(id,name,avatar_url,is_admin)';

interface MissionRow {
  readonly id: string;
  readonly created_by: string;
  readonly title: string;
  readonly description: string;
  readonly scheduled_for: string | null;
  readonly xp: number;
  readonly stops_total: number;
  readonly stops: readonly string[] | null;
  readonly theme: string | null;
  readonly media: readonly MissionMedia[] | null;
  readonly position: number;
  readonly edited_at: string | null;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

interface ProgressRow {
  readonly mission_id: string;
  readonly stops_done: number;
  readonly status: MissionStatus;
}

interface ProgressCounts {
  readonly accepted: number;
  readonly completed: number;
}

const ZERO_COUNTS: ProgressCounts = { accepted: 0, completed: 0 };

// The viewer's own completed stop indices per mission, batched into one
// query across every mission in the view rather than one per mission --
// mirrors loadProgressCounts's batching for the same reason.
async function loadCompletedStopIndices(
  supabase: SupabaseClient,
  userId: string,
  missionIds: readonly string[],
): Promise<ReadonlyMap<string, readonly number[]>> {
  if (missionIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from('mission_check_ins')
    .select('mission_id,stop_index')
    .eq('user_id', userId)
    .in('mission_id', missionIds);
  throwIfSupabaseError(error, 'load completed mission stops');
  const byMission = new Map<string, number[]>();
  for (const row of (data ?? []) as { mission_id: string; stop_index: number }[]) {
    const current = byMission.get(row.mission_id) ?? [];
    current.push(row.stop_index);
    byMission.set(row.mission_id, current);
  }
  for (const indices of byMission.values()) {
    indices.sort((a, b) => a - b);
  }
  return byMission;
}

// Community-wide accept/complete counts, not scoped to any one requesting
// user (unlike ProgressRow above) -- one grouped query per missions fetch
// rather than one per mission.
async function loadProgressCounts(
  supabase: SupabaseClient,
  missionIds: readonly string[],
): Promise<ReadonlyMap<string, ProgressCounts>> {
  if (missionIds.length === 0) {
    return new Map();
  }
  const { data, error } = await supabase
    .from('mission_progress')
    .select('mission_id,status')
    .in('mission_id', missionIds);
  throwIfSupabaseError(error, 'load mission progress counts');
  const counts = new Map<string, ProgressCounts>();
  for (const row of (data ?? []) as unknown as { mission_id: string; status: MissionStatus }[]) {
    const current = counts.get(row.mission_id) ?? ZERO_COUNTS;
    counts.set(row.mission_id, {
      accepted: current.accepted + 1,
      completed: current.completed + (row.status === 'done' ? 1 : 0),
    });
  }
  return counts;
}

interface UserRow {
  readonly xp: number;
  readonly missions_completed: number;
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

// Builds toMissionView's nameById map from rows already carrying their own
// embedded `author` (see MISSION_SELECT) -- a plain in-memory fold, not a
// query, since the join already happened server-side as part of fetching
// missionRows itself.
const nameByIdFromRows = (
  rows: readonly MissionRow[],
): ReadonlyMap<string, PersonLookup> =>
  new Map(
    rows.flatMap((row) =>
      row.author
        ? ([
            [
              row.created_by,
              {
                avatarUrl: row.author.avatar_url,
                isAdmin: row.author.is_admin,
                name: row.author.name,
              },
            ],
          ] as const)
        : [],
    ),
  );

const toMissionView = (
  row: MissionRow,
  entry: ProgressRow | undefined,
  nameById: ReadonlyMap<string, PersonLookup>,
  counts: ReadonlyMap<string, ProgressCounts> = new Map(),
  completedIndicesByMission: ReadonlyMap<string, readonly number[]> = new Map(),
): Mission => {
  const stopsDone = entry?.stops_done ?? 0;
  const author = nameById.get(row.created_by);
  const missionCounts = counts.get(row.id) ?? ZERO_COUNTS;
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
    completedStopIndices: completedIndicesByMission.get(row.id) ?? [],
    stopsTotal: row.stops_total,
    stops: row.stops ?? [],
    theme: row.theme as MissionTheme | null,
    media: row.media ?? undefined,
    editedAt: row.edited_at,
    acceptedCount: missionCounts.accepted,
    completedCount: missionCounts.completed,
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
    .select('xp,missions_completed')
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

  const nameById = nameByIdFromRows(missionRows);
  const missionIds = missionRows.map((row) => row.id);
  const counts = await loadProgressCounts(supabase, missionIds);
  const completedIndicesByMission = await loadCompletedStopIndices(
    supabase,
    userId,
    missionIds,
  );

  return {
    missions: missionRows.map((row) =>
      toMissionView(
        row,
        progressByMission.get(row.id),
        nameById,
        counts,
        completedIndicesByMission,
      ),
    ),
    progress: buildProgress({
      xp: userRow?.xp ?? 0,
      missionsCompleted: userRow?.missions_completed ?? 0,
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

  const nameById = nameByIdFromRows(missionRows);
  const missionIds = missionRows.map((row) => row.id);
  const counts = await loadProgressCounts(supabase, missionIds);
  const completedIndicesByMission = await loadCompletedStopIndices(
    supabase,
    userId,
    missionIds,
  );

  const filtered = missionRows
    .map((row, index) => ({
      index,
      view: toMissionView(
        row,
        progressByMission.get(row.id),
        nameById,
        counts,
        completedIndicesByMission,
      ),
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
    missionsCompleted: userRow?.missions_completed ?? 0,
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

  const nameById = nameByIdFromRows(missionRows);
  const missionIds = missionRows.map((row) => row.id);
  const counts = await loadProgressCounts(supabase, missionIds);
  const completedIndicesByMission = await loadCompletedStopIndices(
    supabase,
    userId,
    missionIds,
  );

  const wrapped = missionRows.map((row) => ({
    id: row.id,
    row,
    sortKey: String(row.position).padStart(10, '0'),
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    missions: page.items.map((item) =>
      toMissionView(
        item.row,
        progressByMission.get(item.row.id),
        nameById,
        counts,
        completedIndicesByMission,
      ),
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

  const nameById = nameByIdFromRows(missionRows);
  const missionIds = missionRows.map((row) => row.id);
  const counts = await loadProgressCounts(supabase, missionIds);
  const completedIndicesByMission = await loadCompletedStopIndices(
    supabase,
    userId,
    missionIds,
  );

  return missionRows.map((row) =>
    toMissionView(
      row,
      progressByMission.get(row.id),
      nameById,
      counts,
      completedIndicesByMission,
    ),
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
  const counts = await loadProgressCounts(supabase, [missionId]);
  const completedIndicesByMission = await loadCompletedStopIndices(supabase, userId, [
    missionId,
  ]);
  return {
    ok: true,
    mission: toMissionView(row, entry, nameById, counts, completedIndicesByMission),
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
  input?: unknown,
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

  const { data: existingCheckInRows, error: existingCheckInsError } = await supabase
    .from('mission_check_ins')
    .select('stop_index')
    .eq('mission_id', missionId)
    .eq('user_id', userId);
  throwIfSupabaseError(existingCheckInsError, 'load existing mission check-ins');
  const completedIndices = ((existingCheckInRows ?? []) as { stop_index: number }[])
    .map((row) => row.stop_index)
    .sort((a, b) => a - b);
  const completedSet = new Set(completedIndices);

  // Omitted -- default to the lowest not-yet-completed stop, preserving the
  // old always-sequential behavior for any caller that doesn't specify one.
  // Provided -- any stop can be checked into, in any order; only its own
  // completion state (not stops before it) is validated. The table's own
  // unique (mission_id, user_id, stop_index) constraint (0025) is the
  // race-safe backstop below if two requests somehow pass this check for
  // the same stop at once.
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
    requestedStopIndex >= mission.stops_total
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

  // currentStopsDone (mission_progress's own counter) stays the source of
  // truth for the count and mission-complete decision, unchanged from
  // before -- completedIndices (actual mission_check_ins rows) only drives
  // stop selection/dedup above and the response's completedStopIndices.
  const stopsDone = currentStopsDone + 1;
  const completed = stopsDone >= mission.stops_total;
  const awardedXp = completed ? mission.xp : 0;

  // WHY: no photo/face-detection gate -- a good-faith honor system instead.
  // An "is a face present" check was trivially beaten by any photo of any
  // face, so it wasn't buying real deterrence, and pulled in a multi-MB
  // dependency that blew out every mission-route bundle. The UI carries the
  // honesty message instead. A photo is entirely optional here -- attaching
  // one is a fun add-on to the gallery, never a requirement to complete. A
  // failed upload doesn't block the check-in itself (mirrors
  // extractAvatarUpload's best-effort handling in profile-supabase.ts) --
  // losing the photo is far less harmful than losing the XP/progress.
  const photoUpload = extractCheckInPhoto(input);
  const photoUrl = photoUpload
    ? await uploadDataUrl(supabase, photoUpload.dataUrl, photoUpload.filename, 'mission-checkins', userId)
    : null;
  const { error: checkInInsertError } = await supabase.from('mission_check_ins').insert({
    mission_id: missionId,
    user_id: userId,
    stop_index: stopIndex,
    photo_url: photoUrl,
  });
  if (checkInInsertError?.code === '23505') {
    return {
      ok: false,
      status: 409,
      code: 'stop_already_complete',
      message: 'You’ve already checked into this stop.',
    };
  }
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
  const baseMissions = userRow?.missions_completed ?? 0;
  let finalXp = baseXp;
  let finalMissions = baseMissions;

  if (completed) {
    // Atomic + dedupe-safe: bumps app_users.xp and inserts the matching
    // xp_ledger row together, and no-ops (returns null) if this exact
    // (user, mission_completed, missionId) grant was already recorded --
    // see grant_xp_and_log in supabase/migrations/0064_atomic_grant_xp.sql.
    const { data: xpResult, error: grantError } = await supabase.rpc('grant_xp_and_log', {
      p_amount: mission.xp,
      p_ref_id: missionId,
      p_reason: 'mission_completed',
    });
    throwIfSupabaseError(grantError, 'grant mission xp');
    if (xpResult !== null) {
      finalXp = xpResult as number;
      finalMissions = baseMissions + 1;
      const { error: missionCountError } = await supabase
        .from('app_users')
        .update({ missions_completed: finalMissions })
        .eq('id', userId);
      throwIfSupabaseError(missionCountError, 'save mission user progress');
    }
  }

  const authorNameById = await nameMapFor(supabase, mission.created_by);
  const author = authorNameById.get(mission.created_by);
  const counts = (await loadProgressCounts(supabase, [missionId])).get(missionId) ?? ZERO_COUNTS;
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
    completedStopIndices: [...completedIndices, stopIndex].sort((a, b) => a - b),
    stopsTotal: mission.stops_total,
    stops: mission.stops ?? [],
    theme: mission.theme as MissionTheme | null,
    media: mission.media ?? undefined,
    editedAt: mission.edited_at,
    acceptedCount: counts.accepted,
    completedCount: counts.completed,
  };

  return {
    ok: true,
    body: {
      mission: missionView,
      awardedXp,
      progress: buildProgress({
        xp: finalXp,
        missionsCompleted: finalMissions,
      }),
    },
  };
}

const CHECK_IN_PHOTO_SELECT =
  'id,mission_id,user_id,stop_index,completed_at,photo_url,like_count,author:app_users!mission_check_ins_user_id_fkey(id,name,avatar_url,is_admin)';

interface CheckInPhotoRow {
  readonly id: string;
  readonly mission_id: string;
  readonly user_id: string;
  readonly stop_index: number;
  readonly completed_at: string;
  readonly photo_url: string | null;
  readonly like_count: number;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

const toCheckInPhoto = (row: CheckInPhotoRow, likedIds: ReadonlySet<string>) => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.user_id,
    isAdmin: row.author?.is_admin ?? false,
    name: row.author?.name ?? 'Member',
  },
  completedAt: row.completed_at,
  id: row.id,
  liked: likedIds.has(row.id),
  likes: row.like_count,
  missionId: row.mission_id,
  // Non-null by the query's `.not('photo_url', 'is', null)` filter below --
  // TypeScript can't see through a query filter, so this is a plain
  // assertion, not a runtime check.
  photoUrl: row.photo_url as string,
  stopIndex: row.stop_index,
});

// Mirrors likedPostIds (posts-supabase.ts) exactly -- the viewer's own
// check-in-photo like membership, read via the "read own likes" RLS policy
// rather than a broader read of who else liked what.
const likedCheckInPhotoIds = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<ReadonlySet<string>> => {
  const { data, error } = await supabase
    .from('mission_check_in_photo_likes')
    .select('check_in_id')
    .eq('user_id', userId);
  throwIfSupabaseError(error, 'load mission check-in photo likes');
  return new Set((data ?? []).map((row) => row.check_in_id as string));
};

// Newest-first gallery of everyone's optional check-in photos for one
// mission -- mirrors listMissionCommentsPageSupabase's fetch-then-paginate
// shape, but skips the ascending-order inversion trick since a photo
// gallery has no "conversation" to read in order; descending by
// completed_at is already the page's natural order.
export async function listMissionCheckInPhotosSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  limit: number,
  cursor: string | null,
): Promise<MissionCheckInPhotosPage> {
  const [{ data, error }, mutedUserIds, likedIds] = await Promise.all([
    supabase
      .from('mission_check_ins')
      .select(CHECK_IN_PHOTO_SELECT)
      .eq('mission_id', missionId)
      .not('photo_url', 'is', null)
      .order('completed_at', { ascending: false }),
    getMutedUserIdsSupabase(supabase, userId),
    likedCheckInPhotoIds(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load mission check-in photos');
  const mutedSet = new Set(mutedUserIds);
  const rows = ((data as unknown as CheckInPhotoRow[]) ?? []).filter(
    (row) => !mutedSet.has(row.user_id),
  );

  const wrapped = rows.map((row) => ({ id: row.id, row, sortKey: row.completed_at }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    nextCursor: page.nextCursor,
    photos: page.items.map((item) => toCheckInPhoto(item.row, likedIds)),
  };
}

// Mirrors toggleLikeSupabase (posts-supabase.ts) exactly -- same
// exists-then-insert/delete-then-recount shape, scoped to
// mission_check_in_photo_likes/mission_check_ins instead of post_likes/posts.
export async function toggleCheckInPhotoLikeSupabase(
  supabase: SupabaseClient,
  userId: string,
  checkInId: string,
): Promise<LikeCheckInPhotoResult | null> {
  const { data: checkInRow, error: checkInError } = await supabase
    .from('mission_check_ins')
    .select('id')
    .eq('id', checkInId)
    .not('photo_url', 'is', null)
    .maybeSingle();
  throwIfSupabaseError(checkInError, 'load check-in photo');
  if (!checkInRow) {
    return null;
  }
  await ensureUser(supabase, userId);
  const { data: existing, error: existingError } = await supabase
    .from('mission_check_in_photo_likes')
    .select('check_in_id')
    .eq('check_in_id', checkInId)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load check-in photo like membership');

  if (existing) {
    const { error } = await supabase
      .from('mission_check_in_photo_likes')
      .delete()
      .eq('check_in_id', checkInId)
      .eq('user_id', userId);
    throwIfSupabaseError(error, 'unlike check-in photo');
  } else {
    const { error } = await supabase
      .from('mission_check_in_photo_likes')
      .insert({ check_in_id: checkInId, user_id: userId });
    throwIfSupabaseError(error, 'like check-in photo');
  }

  const { data: updated, error: updatedError } = await supabase
    .from('mission_check_ins')
    .select('like_count')
    .eq('id', checkInId)
    .single();
  throwIfSupabaseError(updatedError, 'load check-in photo like count');
  return { id: checkInId, liked: !existing, likes: updated?.like_count ?? 0 };
}

// The check-in that actually finished the mission for this user -- the most
// recently completed row, mirroring findCompletingCheckIn's memory-backend
// counterpart in check-in.ts (stops can be checked into in any order, so the
// highest stop_index is no longer necessarily the last one recorded).
async function loadCompletingCheckInRow(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
): Promise<{ readonly id: string; readonly photo_url: string | null } | null> {
  const { data, error } = await supabase
    .from('mission_check_ins')
    .select('id,photo_url')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfSupabaseError(error, 'load completing mission check-in');
  return data as { id: string; photo_url: string | null } | null;
}

const NOT_COMPLETED_RESULT: MyCheckInPhotoResult = {
  ok: false,
  status: 409,
  code: 'not_completed',
  message: 'You haven’t completed this mission yet.',
};

export async function getMyCheckInPhotoSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
): Promise<MyCheckInPhotoResult> {
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('id,stops_total')
    .eq('id', missionId)
    .maybeSingle();
  throwIfSupabaseError(missionError, 'load mission');
  if (!mission) {
    return {
      ok: false,
      status: 404,
      code: 'mission_not_found',
      message: 'Mission not found.',
    };
  }

  const { data: progress, error: progressError } = await supabase
    .from('mission_progress')
    .select('stops_done')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(progressError, 'load mission progress');
  const stopsDone = (progress as { stops_done: number } | null)?.stops_done ?? 0;
  // Derived the same way toMissionView/resolveStatus compute a viewer's
  // mission status for display, rather than trusting mission_progress's
  // own stored `status` column -- keeps this check by construction unable
  // to disagree with whatever decided the mission detail screen even shows
  // this UI in the first place.
  if (stopsDone < (mission as { stops_total: number }).stops_total) {
    return NOT_COMPLETED_RESULT;
  }

  const checkInRow = await loadCompletingCheckInRow(supabase, userId, missionId);
  return { ok: true, body: { photoUrl: checkInRow?.photo_url ?? null } };
}

export async function updateMyCheckInPhotoSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  input: unknown,
): Promise<MyCheckInPhotoResult> {
  const existing = await getMyCheckInPhotoSupabase(supabase, userId, missionId);
  if (!existing.ok) {
    return existing;
  }

  const checkInRow = await loadCompletingCheckInRow(supabase, userId, missionId);
  if (!checkInRow) {
    return { ok: true, body: { photoUrl: null } };
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  let nextPhotoUrl = checkInRow.photo_url;
  if (raw.removePhoto === true) {
    nextPhotoUrl = null;
  } else {
    const photoUpload = extractCheckInPhoto(input);
    if (photoUpload) {
      const uploadedUrl = await uploadDataUrl(
        supabase,
        photoUpload.dataUrl,
        photoUpload.filename,
        'mission-checkins',
        userId,
      );
      // WHY: a failed upload leaves the existing photo in place rather than
      // erroring the request -- mirrors checkInSupabase's own best-effort
      // handling of this same upload call.
      if (uploadedUrl) {
        nextPhotoUrl = uploadedUrl;
      }
    }
  }

  if (nextPhotoUrl !== checkInRow.photo_url) {
    const { error } = await supabase
      .from('mission_check_ins')
      .update({ photo_url: nextPhotoUrl })
      .eq('id', checkInRow.id);
    throwIfSupabaseError(error, 'update mission check-in photo');
    if (checkInRow.photo_url) {
      await removeStorageObjects(supabase, [checkInRow.photo_url]);
    }
  }

  return { ok: true, body: { photoUrl: nextPhotoUrl } };
}

export async function reportMissionCheckInPhotoSupabase(
  supabase: SupabaseClient,
  userId: string,
  checkInId: string,
  submission: ValidReportSubmission,
): Promise<ReportMissionCheckInPhotoResult> {
  const { data: checkInRow, error: checkInError } = await supabase
    .from('mission_check_ins')
    .select('id')
    .eq('id', checkInId)
    .not('photo_url', 'is', null)
    .maybeSingle();
  throwIfSupabaseError(checkInError, 'load reported check-in photo');
  if (!checkInRow) {
    return { code: 'check_in_not_found', message: 'Check-in photo not found.', ok: false };
  }

  await ensureUser(supabase, userId);
  const evidenceImageUrl = await uploadReportEvidence(
    supabase,
    userId,
    submission.evidenceImageDataUrl,
  );
  // Idempotent: a unique (check_in_id, reporter_id) constraint on
  // mission_check_in_photo_reports means a repeat report from the same user
  // is a silent no-op, not an error.
  const { error } = await supabase.from('mission_check_in_photo_reports').upsert(
    {
      check_in_id: checkInId,
      details: submission.details,
      evidence_image_url: evidenceImageUrl,
      reason: submission.reason,
      reporter_id: userId,
    },
    { ignoreDuplicates: true, onConflict: 'check_in_id,reporter_id' },
  );
  throwIfSupabaseError(error, 'report mission check-in photo');
  return { ok: true, reported: true };
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
  const counts = await loadProgressCounts(supabase, [missionId]);
  const completedIndicesByMission = await loadCompletedStopIndices(supabase, userId, [
    missionId,
  ]);
  return {
    ok: true,
    mission: toMissionView(mission, entry, nameById, counts, completedIndicesByMission),
  };
}

export async function reportMissionSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  submission: ValidReportSubmission,
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
  const evidenceImageUrl = await uploadReportEvidence(
    supabase,
    userId,
    submission.evidenceImageDataUrl,
  );
  // Idempotent: a unique (mission_id, reporter_id) constraint on
  // mission_reports means a repeat report from the same user is a silent
  // no-op, not an error.
  const { error } = await supabase
    .from('mission_reports')
    .upsert(
      {
        details: submission.details,
        evidence_image_url: evidenceImageUrl,
        mission_id: missionId,
        reason: submission.reason,
        reporter_id: userId,
      },
      { ignoreDuplicates: true, onConflict: 'mission_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report mission');
  return { ok: true, reported: true };
}

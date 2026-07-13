import type { SupabaseClient } from '@supabase/supabase-js';

import type { MissionIcon, MissionStatus } from '@/src/backend/store';

import type {
  CheckInResult,
  CreateMissionResult,
  Mission,
  MissionsView,
} from './types';
import { buildProgress, DEFAULT_PROGRESS_TITLE } from './user-progress';
import { validateMissionInput } from './validation';

const MISSION_SELECT =
  'id,title,description,xp,stops_total,icon,position,locked_by_default';

interface MissionRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly xp: number;
  readonly stops_total: number;
  readonly icon: string;
  readonly position: number;
  readonly locked_by_default: boolean;
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

// Mirrors the in-memory resolver: a locked entry stays locked, otherwise the
// status is derived from stop progress so completion is never ambiguous.
const resolveStatus = (
  storedStatus: MissionStatus,
  stopsDone: number,
  stopsTotal: number,
): MissionStatus =>
  storedStatus === 'locked'
    ? 'locked'
    : stopsDone >= stopsTotal
      ? 'done'
      : 'active';

const storedStatusFor = (
  row: MissionRow,
  entry: ProgressRow | undefined,
): MissionStatus =>
  entry ? entry.status : row.locked_by_default ? 'locked' : 'active';

const toMissionView = (
  row: MissionRow,
  entry: ProgressRow | undefined,
): Mission => {
  const stopsDone = entry?.stops_done ?? 0;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    xp: row.xp,
    status: resolveStatus(storedStatusFor(row, entry), stopsDone, row.stops_total),
    stopsDone,
    stopsTotal: row.stops_total,
    icon: row.icon as MissionIcon,
  };
};

// A real Clerk user has no app_users row yet; create it before any owned write
// so foreign keys resolve. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = 'Member',
): Promise<void> => {
  await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
};

const loadUserRow = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRow | null> => {
  const { data } = await supabase
    .from('app_users')
    .select('xp,streak_days,missions_completed,title')
    .eq('id', userId)
    .maybeSingle();
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
  if (error) {
    throw new Error(error.message);
  }
  const missionRows = (data ?? []) as unknown as MissionRow[];

  const { data: progressData } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('user_id', userId);
  const progressByMission = new Map(
    ((progressData ?? []) as unknown as ProgressRow[]).map((row) => [
      row.mission_id,
      row,
    ]),
  );

  const userRow = await loadUserRow(supabase, userId);

  return {
    missions: missionRows.map((row) =>
      toMissionView(row, progressByMission.get(row.id)),
    ),
    progress: buildProgress({
      xp: userRow?.xp ?? 0,
      streakDays: userRow?.streak_days ?? 0,
      missionsCompleted: userRow?.missions_completed ?? 0,
      title: userRow?.title ?? DEFAULT_PROGRESS_TITLE,
    }),
  };
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

  const { data: lastRow } = await supabase
    .from('missions')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((lastRow as { position: number } | null)?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('missions')
    .insert({
      id: `msn-${crypto.randomUUID()}`,
      created_by: userId,
      title: value.title,
      description: value.description,
      xp: value.xp,
      stops_total: value.stopsTotal,
      icon: value.icon,
      position,
      locked_by_default: false,
    })
    .select(MISSION_SELECT)
    .single();
  if (error || !data) {
    return {
      code: 'invalid_mission',
      message: 'Could not create the mission.',
      ok: false,
    };
  }
  return { ok: true, mission: toMissionView(data as unknown as MissionRow, undefined) };
}

export async function checkInSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
): Promise<CheckInResult> {
  await ensureUser(supabase, userId);

  const { data: missionData } = await supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('id', missionId)
    .maybeSingle();
  const mission = missionData as MissionRow | null;
  if (!mission) {
    return {
      ok: false,
      status: 404,
      code: 'mission_not_found',
      message: 'Mission not found.',
    };
  }

  const { data: entryData } = await supabase
    .from('mission_progress')
    .select('mission_id,stops_done,status')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();
  const entry = (entryData as ProgressRow | null) ?? undefined;

  const currentStopsDone = entry?.stops_done ?? 0;
  const status = resolveStatus(
    storedStatusFor(mission, entry),
    currentStopsDone,
    mission.stops_total,
  );

  if (status === 'locked') {
    return {
      ok: false,
      status: 409,
      code: 'mission_locked',
      message: 'Mission is locked.',
    };
  }

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

  await supabase.from('mission_progress').upsert(
    {
      mission_id: missionId,
      user_id: userId,
      stops_done: stopsDone,
      status: completed ? 'done' : 'active',
    },
    { onConflict: 'mission_id,user_id' },
  );

  const userRow = await loadUserRow(supabase, userId);
  const baseXp = userRow?.xp ?? 0;
  const baseStreak = userRow?.streak_days ?? 0;
  const baseMissions = userRow?.missions_completed ?? 0;
  const title = userRow?.title ?? DEFAULT_PROGRESS_TITLE;

  // WHY: streaks are intentionally naive — +1 day per completing check-in, no
  // calendar tracking. Documented in the API contract and matches the memory path.
  if (completed) {
    await supabase
      .from('app_users')
      .update({
        xp: baseXp + mission.xp,
        missions_completed: baseMissions + 1,
        streak_days: baseStreak + 1,
      })
      .eq('id', userId);
  }

  const missionView: Mission = {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    xp: mission.xp,
    status: completed ? 'done' : 'active',
    stopsDone,
    stopsTotal: mission.stops_total,
    icon: mission.icon as MissionIcon,
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

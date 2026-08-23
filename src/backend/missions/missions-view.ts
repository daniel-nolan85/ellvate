import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import { getUserMissionEntry, resolveMissionStatus, toMissionView } from './mission-view';
import {
  getMissionsByIdsSupabase,
  getMissionsViewSupabase,
  getMyMissionsViewSupabase,
  getUserProgressSupabase,
  listMissionsPageSupabase,
} from './missions-supabase';
import type {
  ListMissionsOptions,
  Mission,
  MissionFilter,
  MissionsPage,
  MissionsView,
  MyMissionsOptions,
  MyMissionsPage,
  UserProgress,
} from './types';
import { buildUserProgress } from './user-progress';

export const DEFAULT_MY_MISSIONS_PAGE_SIZE = 20;
export const MAX_MY_MISSIONS_PAGE_SIZE = 50;
export const DEFAULT_MISSIONS_PAGE_SIZE = 20;
export const MAX_MISSIONS_PAGE_SIZE = 50;

function getMissionsViewMemory(userId: string): MissionsView {
  const state = getState();

  return {
    missions: state.missions.map((mission) =>
      toMissionView(mission, userId, state.users),
    ),
    progress: buildUserProgress(state.users.find((user) => user.id === userId)),
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

// The paginated, filtered counterpart to getMissionsViewMemory (used by the
// public browse feed; getMissionsViewMemory itself stays unbounded for
// internal callers like the assistant's local search and public-profile
// stats, which need to scan every mission). Missions have no creation
// timestamp -- array position (insertion order, missions are always
// appended) stands in as the recency sort key, same as getMyMissionsViewMemory.
// paginateInMemory always sorts descending by sortKey, but the browse order
// here has always been oldest-first (array/position order); inverting the
// sortKey preserves that instead of silently flipping it to newest-first.
const MAX_MISSION_POSITION = 9_999_999;

function listMissionsPageMemory(
  userId: string,
  filter: MissionFilter,
  limit: number,
  cursor: string | null,
): MissionsPage {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const filtered = state.missions
    .filter((mission) => !mutedUserIds.has(mission.authorId))
    .map((mission, index) => ({
      index,
      mission,
      view: toMissionView(mission, userId, state.users),
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

function getUserProgressMemory(userId: string): UserProgress {
  const state = getState();
  return buildUserProgress(state.users.find((user) => user.id === userId));
}

// Scoped to missions the caller created or completed — bounded by one user's
// own activity rather than the whole community's mission list (unlike
// getMissionsViewMemory, which every screen but the activity hub needs).
// Missions have no creation timestamp, so array position (insertion order,
// missions are always appended) stands in as the recency sort key.
function getMyMissionsViewMemory(
  userId: string,
  limit: number,
  cursor: string | null,
): MyMissionsPage {
  const state = getState();
  const mine = state.missions
    .map((mission, index) => ({ index, mission }))
    .filter(({ mission }) => {
      const entry = getUserMissionEntry(mission, userId);
      return (
        mission.authorId === userId ||
        resolveMissionStatus(mission, entry) === 'done'
      );
    })
    .map(({ index, mission }) => ({
      id: mission.id,
      mission,
      sortKey: String(index).padStart(10, '0'),
    }));
  const page = paginateInMemory(mine, limit, cursor);

  return {
    missions: page.items.map((item) =>
      toMissionView(item.mission, userId, state.users),
    ),
    nextCursor: page.nextCursor,
  };
}

// Fetches specific missions by id — used to hydrate bookmarks, which can
// point at any mission regardless of authorship or completion status.
function getMissionsByIdsMemory(
  userId: string,
  ids: readonly string[],
): readonly Mission[] {
  const state = getState();
  const idSet = new Set(ids);
  return state.missions
    .filter((mission) => idSet.has(mission.id))
    .map((mission) => toMissionView(mission, userId, state.users));
}

export async function getMissionsView(
  ctx: RequestContext,
): Promise<MissionsView> {
  return ctx.supabase
    ? getMissionsViewSupabase(ctx.supabase, ctx.userId)
    : getMissionsViewMemory(ctx.userId);
}

// The paginated, filtered counterpart to getMissionsView, used by the public
// browse feed (see listMissionsPageMemory for why the two are kept separate).
export async function listMissionsPage(
  ctx: RequestContext,
  options: ListMissionsOptions,
): Promise<MissionsPage> {
  const limit = Math.min(
    Math.max(1, options.limit ?? DEFAULT_MISSIONS_PAGE_SIZE),
    MAX_MISSIONS_PAGE_SIZE,
  );
  const cursor = options.cursor ?? null;
  return ctx.supabase
    ? listMissionsPageSupabase(ctx.supabase, ctx.userId, options.filter, limit, cursor)
    : listMissionsPageMemory(ctx.userId, options.filter, limit, cursor);
}

export async function getUserProgress(ctx: RequestContext): Promise<UserProgress> {
  return ctx.supabase
    ? getUserProgressSupabase(ctx.supabase, ctx.userId)
    : getUserProgressMemory(ctx.userId);
}

export async function getMissionsByIds(
  ctx: RequestContext,
  ids: readonly string[],
): Promise<readonly Mission[]> {
  if (ids.length === 0) {
    return [];
  }
  return ctx.supabase
    ? getMissionsByIdsSupabase(ctx.supabase, ctx.userId, ids)
    : getMissionsByIdsMemory(ctx.userId, ids);
}

export async function getMyMissionsView(
  ctx: RequestContext,
  options?: MyMissionsOptions,
): Promise<MyMissionsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_MY_MISSIONS_PAGE_SIZE),
    MAX_MY_MISSIONS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? getMyMissionsViewSupabase(ctx.supabase, ctx.userId, limit, cursor)
    : getMyMissionsViewMemory(ctx.userId, limit, cursor);
}

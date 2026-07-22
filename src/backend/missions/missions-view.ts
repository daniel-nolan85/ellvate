import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import { getUserMissionEntry, resolveMissionStatus, toMissionView } from './mission-view';
import { getMissionsViewSupabase, getMyMissionsViewSupabase } from './missions-supabase';
import type { MissionsView, MyMissionsOptions, MyMissionsPage } from './types';
import { buildUserProgress } from './user-progress';

export const DEFAULT_MY_MISSIONS_PAGE_SIZE = 20;
export const MAX_MY_MISSIONS_PAGE_SIZE = 50;

function getMissionsViewMemory(userId: string): MissionsView {
  const state = getState();

  return {
    missions: state.missions.map((mission) =>
      toMissionView(mission, userId, state.users),
    ),
    progress: buildUserProgress(state.users.find((user) => user.id === userId)),
  };
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

export async function getMissionsView(
  ctx: RequestContext,
): Promise<MissionsView> {
  return ctx.supabase
    ? getMissionsViewSupabase(ctx.supabase, ctx.userId)
    : getMissionsViewMemory(ctx.userId);
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

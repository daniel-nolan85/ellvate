import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';

import { toMissionView } from './mission-view';
import { getMissionsViewSupabase } from './missions-supabase';
import type { MissionsView } from './types';
import { buildUserProgress } from './user-progress';

function getMissionsViewMemory(userId: string): MissionsView {
  const state = getState();

  return {
    missions: state.missions.map((mission) => toMissionView(mission, userId)),
    progress: buildUserProgress(state.users.find((user) => user.id === userId)),
  };
}

export async function getMissionsView(
  ctx: RequestContext,
): Promise<MissionsView> {
  return ctx.supabase
    ? getMissionsViewSupabase(ctx.supabase, ctx.userId)
    : getMissionsViewMemory(ctx.userId);
}

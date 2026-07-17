import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { deleteMissionSupabase } from './missions-supabase';

function deleteMissionMemory(userId: string, missionId: string): boolean {
  const existing = getState().missions.find(
    (mission) => mission.id === missionId && mission.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => ({
    ...current,
    missions: current.missions.filter((mission) => mission.id !== missionId),
  }));
  return true;
}

export async function deleteMission(
  ctx: RequestContext,
  missionId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteMissionSupabase(ctx.supabase, ctx.userId, missionId)
    : deleteMissionMemory(ctx.userId, missionId);
}

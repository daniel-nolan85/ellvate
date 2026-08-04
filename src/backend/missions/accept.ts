import type { RequestContext } from '@/src/backend/http';
import { ensureUser, getState, setState } from '@/src/backend/store';

import { toMissionView } from './mission-view';
import { acceptMissionSupabase } from './missions-supabase';
import type { AcceptMissionResult } from './types';

// Creates a 0-stops progress row for the user if one doesn't already exist —
// idempotent, since accepting twice (or accepting a mission you've already
// started) must never reset real progress.
function acceptMissionMemory(userId: string, missionId: string): AcceptMissionResult {
  ensureUser(userId);
  const state = getState();
  const mission = state.missions.find((item) => item.id === missionId);

  if (!mission) {
    return {
      ok: false,
      status: 404,
      code: 'mission_not_found',
      message: 'Mission not found.',
    };
  }

  if (userId in mission.progressByUser) {
    return { ok: true, mission: toMissionView(mission, userId, state.users) };
  }

  const next = setState((current) => ({
    ...current,
    missions: current.missions.map((item) =>
      item.id === missionId
        ? {
            ...item,
            progressByUser: {
              ...item.progressByUser,
              [userId]: { completedAt: null, status: 'active' as const, stopsDone: 0 },
            },
          }
        : item,
    ),
  }));
  const updated = next.missions.find((item) => item.id === missionId);
  if (!updated) {
    throw new Error('accept mission: mission vanished after update.');
  }
  return { ok: true, mission: toMissionView(updated, userId, next.users) };
}

export async function acceptMission(
  ctx: RequestContext,
  missionId: string,
): Promise<AcceptMissionResult> {
  return ctx.supabase
    ? acceptMissionSupabase(ctx.supabase, ctx.userId, missionId)
    : acceptMissionMemory(ctx.userId, missionId);
}

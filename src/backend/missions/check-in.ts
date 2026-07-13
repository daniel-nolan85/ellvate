import { ensureUser, getState, setState } from '@/src/backend/store';

import { getUserMissionEntry, resolveMissionStatus } from './mission-view';
import { buildUserProgress } from './user-progress';
import type { CheckInResult, Mission } from './types';

export function checkIn(userId: string, missionId: string): CheckInResult {
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

  const stopsDone = entry.stopsDone + 1;
  const completed = stopsDone >= mission.stopsTotal;
  const awardedXp = completed ? mission.xp : 0;

  // WHY: streaks are intentionally naive for the demo store — +1 day per
  // completing check-in, no calendar tracking. Documented in the API contract.
  const next = setState((state) => ({
    ...state,
    missions: state.missions.map((item) =>
      item.id === missionId
        ? {
            ...item,
            progressByUser: {
              ...item.progressByUser,
              [userId]: {
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
                streakDays: user.streakDays + 1,
              }
            : user,
        )
      : state.users,
  }));

  const missionView: Mission = {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    xp: mission.xp,
    status: completed ? 'done' : 'active',
    stopsDone,
    stopsTotal: mission.stopsTotal,
    icon: mission.icon,
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

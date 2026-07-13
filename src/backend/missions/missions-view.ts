import { getState } from '@/src/backend/store';

import { toMissionView } from './mission-view';
import { buildUserProgress } from './user-progress';
import type { MissionsView } from './types';

export function getMissionsView(userId: string): MissionsView {
  const state = getState();

  return {
    missions: state.missions.map((mission) => toMissionView(mission, userId)),
    progress: buildUserProgress(state.users.find((user) => user.id === userId)),
  };
}

import type {
  MissionStatus,
  MissionUserProgress,
  StoredMission,
} from '@/src/backend/store';

import type { Mission } from './types';

const DEFAULT_ENTRY: MissionUserProgress = { status: 'active', stopsDone: 0 };

export function getUserMissionEntry(
  mission: StoredMission,
  userId: string,
): MissionUserProgress {
  return mission.progressByUser[userId] ?? DEFAULT_ENTRY;
}

export function resolveMissionStatus(
  mission: StoredMission,
  entry: MissionUserProgress,
): MissionStatus {
  if (entry.status === 'locked') {
    return 'locked';
  }

  return entry.stopsDone >= mission.stopsTotal ? 'done' : 'active';
}

export function toMissionView(
  mission: StoredMission,
  userId: string,
): Mission {
  const entry = getUserMissionEntry(mission, userId);

  return {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    xp: mission.xp,
    status: resolveMissionStatus(mission, entry),
    stopsDone: entry.stopsDone,
    stopsTotal: mission.stopsTotal,
    icon: mission.icon,
  };
}

import type {
  MissionStatus,
  MissionUserProgress,
  StoredMission,
  StoredUser,
} from '@/src/backend/store';

import type { Mission, PersonRef } from './types';

const DEFAULT_ENTRY: MissionUserProgress = {
  completedAt: null,
  status: 'active',
  stopsDone: 0,
};

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

// The fallback branch is reachable when the author's account has since been
// deleted (missions.created_by is orphaned rather than cascade-deleted, to
// keep the mission itself around) — "Former member" reads correctly for any
// viewer, unlike a name implying the viewer is the author.
export const toAuthorRef = (
  users: readonly StoredUser[],
  authorId: string,
): PersonRef => {
  const user = users.find((candidate) => candidate.id === authorId);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id: authorId, name: 'Former member' };
};

export function toMissionView(
  mission: StoredMission,
  userId: string,
  users: readonly StoredUser[] = [],
): Mission {
  const entry = getUserMissionEntry(mission, userId);

  return {
    id: mission.id,
    author: toAuthorRef(users, mission.authorId),
    title: mission.title,
    description: mission.description,
    scheduledFor: mission.scheduledFor,
    xp: mission.xp,
    status: resolveMissionStatus(mission, entry),
    stopsDone: entry.stopsDone,
    stopsTotal: mission.stopsTotal,
    icon: mission.icon,
    media: mission.media,
  };
}

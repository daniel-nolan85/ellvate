import type {
  MissionStatus,
  MissionUserProgress,
  StoredMission,
  StoredMissionCheckIn,
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

export function completedStopIndicesFor(
  missionCheckIns: readonly StoredMissionCheckIn[],
  missionId: string,
  userId: string,
): readonly number[] {
  return missionCheckIns
    .filter((row) => row.missionId === missionId && row.userId === userId)
    .map((row) => row.stopIndex)
    .sort((a, b) => a - b);
}

export function resolveMissionStatus(
  mission: StoredMission,
  entry: MissionUserProgress,
): MissionStatus {
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
    ? { avatarUrl: user.avatarUrl, id: user.id, isAdmin: user.isAdmin, name: user.name }
    : { avatarUrl: null, id: authorId, isAdmin: false, name: 'Former member' };
};

export function toMissionView(
  mission: StoredMission,
  userId: string,
  users: readonly StoredUser[] = [],
  missionCheckIns: readonly StoredMissionCheckIn[] = [],
): Mission {
  const entry = getUserMissionEntry(mission, userId);
  const allProgress = Object.values(mission.progressByUser);

  return {
    id: mission.id,
    author: toAuthorRef(users, mission.authorId),
    title: mission.title,
    description: mission.description,
    scheduledFor: mission.scheduledFor,
    xp: mission.xp,
    status: resolveMissionStatus(mission, entry),
    accepted: userId in mission.progressByUser,
    stopsDone: entry.stopsDone,
    completedStopIndices: completedStopIndicesFor(missionCheckIns, mission.id, userId),
    stopsTotal: mission.stopsTotal,
    stops: mission.stops,
    theme: mission.theme,
    media: mission.media,
    editedAt: mission.editedAt,
    acceptedCount: allProgress.length,
    completedCount: allProgress.filter((p) => p.status === 'done').length,
  };
}

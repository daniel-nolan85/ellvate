import { getState } from '@/src/backend/store';
import type { StoredUser } from '@/src/backend/store';

export interface PersonRef {
  readonly id: string;
  readonly name: string;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly user: PersonRef;
  readonly isMe: boolean;
  readonly missionsCompleted: number;
  readonly xp: number;
  readonly rankDelta: number;
}

export interface LeaderboardResult {
  readonly leaders: readonly LeaderboardEntry[];
}

const byMissionsThenXp = (a: StoredUser, b: StoredUser): number =>
  b.missionsCompleted - a.missionsCompleted || b.xp - a.xp;

const toEntry = (
  user: StoredUser,
  rank: number,
  requestingUserId: string,
): LeaderboardEntry => ({
  rank,
  user: { id: user.id, name: user.name },
  isMe: user.id === requestingUserId,
  missionsCompleted: user.missionsCompleted,
  xp: user.xp,
  rankDelta: user.previousRank === null ? 0 : user.previousRank - rank,
});

export function getLeaderboard(userId: string): LeaderboardResult {
  const ranked = getState()
    .users.filter((user) => user.missionsCompleted > 0)
    .sort(byMissionsThenXp);

  return {
    leaders: ranked.map((user, index) => toEntry(user, index + 1, userId)),
  };
}

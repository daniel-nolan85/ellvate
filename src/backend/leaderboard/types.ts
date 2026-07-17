export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
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

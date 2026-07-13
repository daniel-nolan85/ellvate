import type { MissionIcon, MissionStatus } from '@/src/backend/store';

export interface Mission {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly xp: number;
  readonly status: MissionStatus;
  readonly stopsDone: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
}

export interface UserProgress {
  readonly level: number;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly title: string;
}

export interface MissionsView {
  readonly missions: readonly Mission[];
  readonly progress: UserProgress;
}

export interface CheckInResponse {
  readonly mission: Mission;
  readonly awardedXp: number;
  readonly progress: UserProgress;
}

export type CheckInErrorCode =
  | 'mission_not_found'
  | 'mission_locked'
  | 'mission_complete';

export interface CheckInFailure {
  readonly ok: false;
  readonly status: number;
  readonly code: CheckInErrorCode;
  readonly message: string;
}

export interface CheckInSuccess {
  readonly ok: true;
  readonly body: CheckInResponse;
}

export type CheckInResult = CheckInSuccess | CheckInFailure;

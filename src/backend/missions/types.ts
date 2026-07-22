import type { MissionIcon, MissionStatus } from '@/src/backend/store';

export interface MissionMedia {
  readonly url: string;
  readonly filename: string;
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface Mission {
  readonly id: string;
  readonly author: PersonRef;
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly status: MissionStatus;
  readonly stopsDone: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
  readonly media?: readonly MissionMedia[];
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

export interface MyMissionsPage {
  readonly missions: readonly Mission[];
  readonly nextCursor: string | null;
}

export interface MyMissionsOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface ValidatedMission {
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
}

export type MissionValidation =
  | { readonly ok: true; readonly value: ValidatedMission }
  | {
      readonly ok: false;
      readonly code: 'invalid_mission';
      readonly message: string;
    };

export type CreateMissionResult =
  | { readonly ok: true; readonly mission: Mission }
  | {
      readonly ok: false;
      readonly code: 'invalid_mission' | 'media_upload_failed';
      readonly message: string;
    };

export type UpdateMissionResult =
  | { readonly ok: true; readonly mission: Mission }
  | {
      readonly ok: false;
      readonly code:
        | 'invalid_mission'
        | 'mission_not_found'
        | 'forbidden'
        | 'media_upload_failed';
      readonly message: string;
    };

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

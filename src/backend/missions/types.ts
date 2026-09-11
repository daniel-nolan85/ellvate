import type { MissionStatus, MissionTheme } from '@/src/backend/store';

export interface MissionMedia {
  readonly url: string;
  readonly filename: string;
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface Mission {
  readonly id: string;
  readonly author: PersonRef;
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly status: MissionStatus;
  // Whether the viewer has accepted this mission — i.e. a progress row
  // exists for them, even before their first check-in. Distinguishes a
  // fresh "Available" mission (not accepted) from one just accepted with
  // 0/N stops done (both would otherwise look identical).
  readonly accepted: boolean;
  readonly stopsDone: number;
  readonly stopsTotal: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme | null;
  readonly media?: readonly MissionMedia[];
  readonly editedAt: string | null;
  // Community-wide counts, not scoped to the viewer -- how many people
  // total have accepted this mission (a progress row exists for them,
  // whether or not they've finished) and how many have completed it.
  readonly acceptedCount: number;
  readonly completedCount: number;
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

export type MissionFilter = 'available' | 'in-progress' | 'completed';

export interface MissionsPage {
  readonly missions: readonly Mission[];
  readonly nextCursor: string | null;
}

export interface ListMissionsOptions {
  readonly filter: MissionFilter;
  readonly limit?: number;
  readonly cursor?: string | null;
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
  readonly stops: readonly string[];
  readonly theme: MissionTheme | null;
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
  | 'mission_complete'
  | 'photo_required';

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

// Unbounded otherwise — a long-running mission with many participants adds a
// row per stop completion and nothing here is ever deleted. Capped to the
// most recent N, still returned oldest-first within that window.
export const CHECK_INS_LIST_LIMIT = 40;

export interface CheckInEntry {
  readonly id: string;
  readonly missionId: string;
  readonly user: PersonRef;
  readonly stopIndex: number;
  readonly completedAt: string;
  readonly photoUrl: string | null;
}

export type ReportCheckInResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'check_in_not_found';
      readonly message: string;
    };

export type ReportMissionResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'mission_not_found';
      readonly message: string;
    };

export type AcceptMissionResult =
  | { readonly ok: true; readonly mission: Mission }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: 'mission_not_found';
      readonly message: string;
    };

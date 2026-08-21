import type { PetitionCategory, PetitionStatus } from '@/src/backend/store';

export type { PetitionCategory, PetitionStatus } from '@/src/backend/store';

export const PETITION_CATEGORIES: readonly PetitionCategory[] = [
  'safety',
  'maintenance',
  'amenities',
  'landscaping',
  'traffic-parking',
  'noise-nuisance',
  'other',
];

export const PETITION_DEADLINE_OPTIONS: readonly (7 | 14 | 30 | 60 | 90)[] = [7, 14, 30, 60, 90];

// The whole feature stays behind a wall until 200 signatures -- the floor --
// is actually reachable, i.e. until the community has at least that many
// members. required_signatures itself is max(20% of users, 200): whichever
// is bigger, not both at once, so this gate only needs to guarantee the
// floor is achievable, not that 200 stays under some percentage of the
// community.
export const PETITIONS_UNLOCK_MIN_USERS = 200;
export const PETITIONS_SIGNATURE_FLOOR = 200;
export const PETITIONS_SIGNATURE_PERCENT = 0.2;

// Computed once at creation and frozen on the row -- never recalculated as
// the user base grows or shrinks, so a petition's goal doesn't move under
// the people who already signed it.
export function computeRequiredSignatures(totalUsers: number): number {
  return Math.max(Math.ceil(PETITIONS_SIGNATURE_PERCENT * totalUsers), PETITIONS_SIGNATURE_FLOOR);
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface Petition {
  readonly id: string;
  readonly createdBy: PersonRef;
  readonly title: string;
  readonly description: string;
  readonly category: PetitionCategory;
  readonly deadlineDays: 7 | 14 | 30 | 60 | 90;
  readonly deadlineAt: string;
  readonly requiredSignatures: number;
  readonly signatureCount: number;
  readonly status: PetitionStatus;
  readonly succeededAt: string | null;
  readonly hoaResponse: string | null;
  readonly hoaResponseAt: string | null;
  readonly signed: boolean;
  readonly createdAt: string;
}

export interface PetitionsPage {
  readonly petitions: readonly Petition[];
  readonly nextCursor: string | null;
}

export interface ListPetitionsOptions {
  readonly status?: PetitionStatus;
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface PetitionsGate {
  readonly unlocked: boolean;
  readonly totalUsers: number;
  readonly usersNeeded: number;
}

export interface ToggleSignatureResult {
  readonly id: string;
  readonly signed: boolean;
  readonly signatureCount: number;
  readonly status: PetitionStatus;
  readonly justSucceeded: boolean;
}

export type ToggleSignatureOutcome =
  | { readonly ok: true; readonly result: ToggleSignatureResult }
  | {
      readonly ok: false;
      readonly code: 'petition_not_found' | 'petition_not_open';
      readonly message: string;
    };

export type CreatePetitionResult =
  | { readonly ok: true; readonly petition: Petition }
  | {
      readonly ok: false;
      readonly code: 'invalid_petition' | 'petitions_locked';
      readonly message: string;
    };

export type ReportPetitionResult =
  | { readonly ok: true; readonly reported: true }
  | { readonly ok: false; readonly code: 'petition_not_found'; readonly message: string };

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

// The whole feature stays behind a wall until the community has at least
// this many members -- a flat 20% of a tiny community would ask for almost
// nobody's signature to succeed a petition, so this floor exists to make
// sure "20% of the community" means something before the feature is even
// offered, not to guarantee some other number is reachable.
export const PETITIONS_UNLOCK_MIN_USERS = 200;
export const PETITIONS_SIGNATURE_PERCENT = 0.2;

// Computed once at creation and frozen on the row -- never recalculated as
// the user base grows or shrinks, so a petition's goal doesn't move under
// the people who already signed it.
export function computeRequiredSignatures(totalUsers: number): number {
  return Math.ceil(PETITIONS_SIGNATURE_PERCENT * totalUsers);
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface PetitionMedia {
  readonly url: string;
  readonly filename: string;
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
  readonly media?: readonly PetitionMedia[];
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
      readonly code: 'invalid_petition' | 'petitions_locked' | 'media_upload_failed';
      readonly message: string;
    };

export type ReportPetitionResult =
  | { readonly ok: true; readonly reported: true }
  | { readonly ok: false; readonly code: 'petition_not_found'; readonly message: string };

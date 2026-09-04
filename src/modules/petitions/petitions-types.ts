export type PetitionCategory =
  | 'safety'
  | 'maintenance'
  | 'amenities'
  | 'landscaping'
  | 'traffic-parking'
  | 'noise-nuisance'
  | 'other';

export type PetitionStatus = 'open' | 'succeeded' | 'expired';

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

export interface MyPetitionsPage {
  readonly petitions: readonly Petition[];
  readonly nextCursor: string | null;
}

export interface PetitionsGate {
  readonly unlocked: boolean;
  readonly totalUsers: number;
  readonly usersNeeded: number;
}

// Mirrors PETITIONS_SIGNATURE_PERCENT in src/backend/petitions/types.ts --
// duplicated here rather than imported so this client module never reaches
// across the backend boundary. Display-only: the server is what actually
// freezes the real number on create.
export const PETITION_SIGNATURE_PERCENT = 0.2;

export function projectedSignatureGoal(totalUsers: number): number {
  return Math.ceil(PETITION_SIGNATURE_PERCENT * totalUsers);
}

export interface ToggleSignatureResult {
  readonly id: string;
  readonly signed: boolean;
  readonly signatureCount: number;
  readonly status: PetitionStatus;
  readonly justSucceeded: boolean;
}

export interface CreatePetitionInput {
  readonly title: string;
  readonly description: string;
  readonly category: PetitionCategory;
  readonly deadlineDays: 7 | 14 | 30 | 60 | 90;
  readonly newMedia?: readonly { readonly filename: string; readonly dataUrl: string }[];
}

export const PETITION_CATEGORIES: readonly { readonly value: PetitionCategory; readonly label: string }[] = [
  { label: 'Safety', value: 'safety' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Amenities', value: 'amenities' },
  { label: 'Landscaping', value: 'landscaping' },
  { label: 'Traffic & parking', value: 'traffic-parking' },
  { label: 'Noise & nuisance', value: 'noise-nuisance' },
  { label: 'Other', value: 'other' },
];

export const PETITION_DEADLINE_OPTIONS: readonly { readonly value: 7 | 14 | 30 | 60 | 90; readonly label: string }[] = [
  { label: '1 week', value: 7 },
  { label: '2 weeks', value: 14 },
  { label: '1 month', value: 30 },
  { label: '2 months', value: 60 },
  { label: '3 months', value: 90 },
];

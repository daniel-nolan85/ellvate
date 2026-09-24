import type { BusinessCategory } from '@/src/backend/store';
import type { XpGrantOutcome } from '@/src/backend/xp';

export interface BusinessMedia {
  readonly url: string;
  readonly filename: string;
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export type VerificationStatus = 'pending' | 'verified';
export type VerificationMethod = 'domain_match' | 'ai_auto' | 'admin_manual';

export interface BusinessListing {
  readonly id: string;
  readonly author: PersonRef;
  readonly businessName: string;
  readonly category: BusinessCategory;
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly contactWebsite: string | null;
  readonly address: string | null;
  readonly hours: string | null;
  readonly currentSpecial: string | null;
  readonly specialUpdatedAt: string | null;
  readonly logo?: BusinessMedia;
  readonly media?: readonly BusinessMedia[];
  readonly verificationStatus: VerificationStatus;
  readonly verificationMethod: VerificationMethod | null;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface BusinessesView {
  readonly listings: readonly BusinessListing[];
}

export interface BusinessesPage {
  readonly listings: readonly BusinessListing[];
  readonly nextCursor: string | null;
}

export interface ListBusinessesOptions {
  readonly category?: BusinessCategory;
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface MyBusinessListingsPage {
  readonly listings: readonly BusinessListing[];
  readonly nextCursor: string | null;
}

export interface MyBusinessListingsOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface ValidatedBusinessListing {
  readonly businessName: string;
  readonly category: BusinessCategory;
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly contactWebsite: string | null;
  readonly address: string | null;
  readonly hours: string | null;
  readonly currentSpecial: string | null;
}

export type BusinessListingValidation =
  | { readonly ok: true; readonly value: ValidatedBusinessListing }
  | {
      readonly ok: false;
      readonly code: 'invalid_business_listing';
      readonly message: string;
    };

export type CreatedBusinessListingResult =
  | { readonly ok: true; readonly listing: BusinessListing }
  | {
      readonly ok: false;
      readonly code: 'invalid_business_listing' | 'media_upload_failed';
      readonly message: string;
    };

export type CreateBusinessListingResult =
  | { readonly ok: true; readonly listing: BusinessListing; readonly xpAward: XpGrantOutcome }
  | {
      readonly ok: false;
      readonly code: 'invalid_business_listing' | 'media_upload_failed';
      readonly message: string;
    };

export type UpdateBusinessListingResult =
  | { readonly ok: true; readonly listing: BusinessListing }
  | {
      readonly ok: false;
      readonly code:
        | 'invalid_business_listing'
        | 'business_listing_not_found'
        | 'forbidden'
        | 'media_upload_failed';
      readonly message: string;
    };

export type ReportBusinessListingResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'business_listing_not_found';
      readonly message: string;
    };

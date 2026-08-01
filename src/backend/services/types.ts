import type { ServiceCategory } from '@/src/backend/store';

export interface ServiceMedia {
  readonly url: string;
  readonly filename: string;
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface ServiceListing {
  readonly id: string;
  readonly author: PersonRef;
  readonly businessName: string;
  readonly category: ServiceCategory;
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly contactWebsite: string | null;
  readonly serviceArea: string | null;
  readonly hours: string | null;
  readonly logo?: ServiceMedia;
  readonly media?: readonly ServiceMedia[];
  readonly createdAt: string;
  readonly averageRating: number | null;
  readonly reviewCount: number;
}

export interface ServicesView {
  readonly listings: readonly ServiceListing[];
}

export interface ListServicesOptions {
  readonly category?: ServiceCategory;
}

export interface MyServiceListingsPage {
  readonly listings: readonly ServiceListing[];
  readonly nextCursor: string | null;
}

export interface MyServiceListingsOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface ValidatedServiceListing {
  readonly businessName: string;
  readonly category: ServiceCategory;
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly contactWebsite: string | null;
  readonly serviceArea: string | null;
  readonly hours: string | null;
}

export type ServiceListingValidation =
  | { readonly ok: true; readonly value: ValidatedServiceListing }
  | {
      readonly ok: false;
      readonly code: 'invalid_service_listing';
      readonly message: string;
    };

export type CreateServiceListingResult =
  | { readonly ok: true; readonly listing: ServiceListing }
  | {
      readonly ok: false;
      readonly code: 'invalid_service_listing' | 'media_upload_failed';
      readonly message: string;
    };

export type UpdateServiceListingResult =
  | { readonly ok: true; readonly listing: ServiceListing }
  | {
      readonly ok: false;
      readonly code:
        | 'invalid_service_listing'
        | 'service_listing_not_found'
        | 'forbidden'
        | 'media_upload_failed';
      readonly message: string;
    };

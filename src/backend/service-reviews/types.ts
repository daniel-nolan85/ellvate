export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface ServiceReview {
  readonly id: string;
  readonly listingId: string;
  readonly author: PersonRef;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export type CreateServiceReviewResult =
  | { readonly ok: true; readonly review: ServiceReview }
  | {
      readonly ok: false;
      readonly code:
        | 'invalid_review'
        | 'service_listing_not_found'
        | 'forbidden'
        | 'already_reviewed';
      readonly message: string;
    };

export type UpdateServiceReviewResult =
  | { readonly ok: true; readonly review: ServiceReview }
  | {
      readonly ok: false;
      readonly code: 'invalid_review' | 'service_review_not_found' | 'forbidden';
      readonly message: string;
    };

export type ReportServiceReviewResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'service_review_not_found';
      readonly message: string;
    };

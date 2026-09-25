export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface BusinessListingReview {
  readonly id: string;
  readonly listingId: string;
  readonly author: PersonRef;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface BusinessListingReviewsPage {
  readonly reviews: readonly BusinessListingReview[];
  readonly nextCursor: string | null;
}

export type CreateBusinessListingReviewResult =
  | { readonly ok: true; readonly review: BusinessListingReview }
  | {
      readonly ok: false;
      readonly code:
        | 'invalid_review'
        | 'business_listing_not_found'
        | 'forbidden'
        | 'already_reviewed';
      readonly message: string;
    };

export type UpdateBusinessListingReviewResult =
  | { readonly ok: true; readonly review: BusinessListingReview }
  | {
      readonly ok: false;
      readonly code: 'invalid_review' | 'business_listing_review_not_found' | 'forbidden';
      readonly message: string;
    };

export type ReportBusinessListingReviewResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'business_listing_review_not_found';
      readonly message: string;
    };

import type {
  StoredServiceListing,
  StoredServiceReview,
  StoredUser,
} from '@/src/backend/store';

import type { PersonRef, ServiceListing } from './types';

export const toAuthorRef = (
  users: readonly StoredUser[],
  authorId: string,
): PersonRef => {
  const user = users.find((candidate) => candidate.id === authorId);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id: authorId, name: 'You' };
};

export function ratingSummaryFor(
  reviews: readonly StoredServiceReview[],
  listingId: string,
): { readonly averageRating: number | null; readonly reviewCount: number } {
  const forListing = reviews.filter((review) => review.listingId === listingId);
  if (forListing.length === 0) {
    return { averageRating: null, reviewCount: 0 };
  }
  const total = forListing.reduce((sum, review) => sum + review.rating, 0);
  return {
    averageRating: Math.round((total / forListing.length) * 10) / 10,
    reviewCount: forListing.length,
  };
}

export function toServiceListingView(
  listing: StoredServiceListing,
  users: readonly StoredUser[],
  reviews: readonly StoredServiceReview[],
): ServiceListing {
  const { averageRating, reviewCount } = ratingSummaryFor(reviews, listing.id);
  return {
    id: listing.id,
    author: toAuthorRef(users, listing.authorId),
    businessName: listing.businessName,
    category: listing.category,
    description: listing.description,
    contactPhone: listing.contactPhone,
    contactEmail: listing.contactEmail,
    contactWebsite: listing.contactWebsite,
    serviceArea: listing.serviceArea,
    hours: listing.hours,
    logo: listing.logo,
    media: listing.media,
    createdAt: listing.createdAt,
    averageRating,
    reviewCount,
  };
}

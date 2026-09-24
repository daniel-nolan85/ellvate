import type { StoredBusinessListing, StoredUser } from '@/src/backend/store';

import type { BusinessListing, PersonRef } from './types';

export const toAuthorRef = (
  users: readonly StoredUser[],
  authorId: string,
): PersonRef => {
  const user = users.find((candidate) => candidate.id === authorId);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, isAdmin: user.isAdmin, name: user.name }
    : { avatarUrl: null, id: authorId, isAdmin: false, name: 'You' };
};

export function toBusinessListingView(
  listing: StoredBusinessListing,
  users: readonly StoredUser[],
): BusinessListing {
  return {
    id: listing.id,
    author: toAuthorRef(users, listing.authorId),
    businessName: listing.businessName,
    category: listing.category,
    description: listing.description,
    contactPhone: listing.contactPhone,
    contactEmail: listing.contactEmail,
    contactWebsite: listing.contactWebsite,
    address: listing.address,
    hours: listing.hours,
    currentSpecial: listing.currentSpecial,
    specialUpdatedAt: listing.specialUpdatedAt,
    logo: listing.logo,
    media: listing.media,
    verificationStatus: listing.verificationStatus,
    verificationMethod: listing.verificationMethod,
    verifiedAt: listing.verifiedAt,
    createdAt: listing.createdAt,
    editedAt: listing.editedAt,
  };
}

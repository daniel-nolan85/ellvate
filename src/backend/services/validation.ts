import type { ServiceCategory } from '@/src/backend/store';

import type { ServiceListingValidation } from './types';

const MAX_BUSINESS_NAME = 80;
const MAX_DESCRIPTION = 500;
const MAX_CONTACT = 120;
const CATEGORIES: readonly ServiceCategory[] = [
  'pet-care',
  'home-services',
  'beauty',
  'automotive',
  'pool-spa',
  'tech-web',
  'other',
];

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asNullableTrimmedString = (value: unknown): string | null =>
  asTrimmedString(value) || null;

// WHY: a bare domain like "nolancode.com" has no scheme, so Linking.openURL
// (and a plain <a href>) resolves it as a path relative to whatever screen
// the user is currently on instead of an external site — normalize to a
// full https:// URL at save time so every consumer gets a working link
// without each one needing to guess at the user's input format.
const normalizeWebsite = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const invalid = (message: string): ServiceListingValidation => ({
  code: 'invalid_service_listing',
  message,
  ok: false,
});

export function validateServiceListingInput(
  input: unknown,
): ServiceListingValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const businessName = asTrimmedString(raw.businessName);
  const description = asTrimmedString(raw.description);
  const category = asTrimmedString(raw.category) as ServiceCategory;
  const contactPhone = asNullableTrimmedString(raw.contactPhone);
  const contactEmail = asNullableTrimmedString(raw.contactEmail);
  const contactWebsite = normalizeWebsite(asNullableTrimmedString(raw.contactWebsite));
  const serviceArea = asNullableTrimmedString(raw.serviceArea);

  if (!businessName || !description) {
    return invalid('A business name and description are required.');
  }
  if (
    businessName.length > MAX_BUSINESS_NAME ||
    description.length > MAX_DESCRIPTION
  ) {
    return invalid('A listing field exceeds its maximum length.');
  }
  if (!CATEGORIES.includes(category)) {
    return invalid('Pick a valid category.');
  }
  if (
    (contactPhone !== null && contactPhone.length > MAX_CONTACT) ||
    (contactEmail !== null && contactEmail.length > MAX_CONTACT) ||
    (contactWebsite !== null && contactWebsite.length > MAX_CONTACT) ||
    (serviceArea !== null && serviceArea.length > MAX_CONTACT)
  ) {
    return invalid('A contact field exceeds its maximum length.');
  }
  if (!contactPhone && !contactEmail && !contactWebsite) {
    return invalid('Add at least one way for neighbors to reach you.');
  }

  return {
    ok: true,
    value: {
      businessName,
      category,
      contactEmail,
      contactPhone,
      contactWebsite,
      description,
      serviceArea,
    },
  };
}

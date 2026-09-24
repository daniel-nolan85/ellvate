import type { BusinessCategory } from '@/src/backend/store';

import type { BusinessListingValidation } from './types';

const MAX_BUSINESS_NAME = 80;
const MAX_DESCRIPTION = 1000;
const MAX_CONTACT = 120;
const MAX_SPECIAL = 200;
const CATEGORIES: readonly BusinessCategory[] = [
  'restaurants-bars',
  'goods',
  'hospitality',
  'professional-trade',
];

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asNullableTrimmedString = (value: unknown): string | null =>
  asTrimmedString(value) || null;

// WHY: a bare domain like "sunsetgrill.com" has no scheme, so Linking.openURL
// (and a plain <a href>) resolves it as a path relative to whatever screen
// the user is currently on instead of an external site — normalize to a
// full https:// URL at save time. Same helper as services/validation.ts;
// duplicated rather than shared since the two modules are deliberately kept
// independent (see business-listings/index.ts's module-boundary note).
const normalizeWebsite = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

// Extracts a bare registrable-ish domain for the verification pipeline's
// domain-match tier -- deliberately simple (strip scheme, strip an email's
// local-part, strip "www.", lowercase, take everything before the first
// "/") rather than a full public-suffix-list lookup, since this only needs
// to answer "do these two strings plausibly refer to the same domain," not
// validate real-world DNS. Used polymorphically on both website URLs and
// email addresses -- the "@"-split makes "hello@example.com" and
// "https://www.example.com" both resolve to "example.com".
export function extractDomain(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const withoutScheme = value.replace(/^https?:\/\//i, '');
  const withoutPath = withoutScheme.split(/[/?#]/)[0] ?? '';
  const withoutLocalPart = withoutPath.includes('@')
    ? (withoutPath.split('@').pop() ?? '')
    : withoutPath;
  const withoutWww = withoutLocalPart.replace(/^www\./i, '');
  const domain = withoutWww.trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

const invalid = (message: string): BusinessListingValidation => ({
  code: 'invalid_business_listing',
  message,
  ok: false,
});

export function validateBusinessListingInput(
  input: unknown,
): BusinessListingValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const businessName = asTrimmedString(raw.businessName);
  const description = asTrimmedString(raw.description);
  const category = asTrimmedString(raw.category) as BusinessCategory;
  const contactPhone = asNullableTrimmedString(raw.contactPhone);
  const contactEmail = asNullableTrimmedString(raw.contactEmail);
  const contactWebsite = normalizeWebsite(asNullableTrimmedString(raw.contactWebsite));
  const address = asNullableTrimmedString(raw.address);
  const hours = asNullableTrimmedString(raw.hours);
  const currentSpecial = asNullableTrimmedString(raw.currentSpecial);

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
    (address !== null && address.length > MAX_CONTACT) ||
    (hours !== null && hours.length > MAX_CONTACT)
  ) {
    return invalid('A contact field exceeds its maximum length.');
  }
  if (currentSpecial !== null && currentSpecial.length > MAX_SPECIAL) {
    return invalid('The current special exceeds its maximum length.');
  }
  if (!contactPhone && !contactEmail && !contactWebsite) {
    return invalid('Add at least one way for neighbors to reach you.');
  }

  return {
    ok: true,
    value: {
      address,
      businessName,
      category,
      contactEmail,
      contactPhone,
      contactWebsite,
      currentSpecial,
      description,
      hours,
    },
  };
}

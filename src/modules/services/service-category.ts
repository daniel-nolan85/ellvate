import type { AppIconName } from '@/src/components/ui/icon';
import { CATEGORY_ACCENT_ICON_COLOR, type CategoryAccent } from '@/src/lib/category-accent';

import type { ServiceCategory } from './use-services';

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  'home-services',
  'pet-care',
  'automotive',
  'pool-spa',
  'beauty',
  'tech-web',
  'dining',
  'other',
];

export const SERVICE_CATEGORY_LABEL: Readonly<Record<ServiceCategory, string>> = {
  automotive: 'Automotive',
  beauty: 'Beauty',
  dining: 'Dining',
  'home-services': 'Home services',
  other: 'Other',
  'pet-care': 'Pet care',
  'pool-spa': 'Pool & spa',
  'tech-web': 'Tech & web',
};

// Reuses the same 5-accent palette the forum's category chips use, mapped by
// what each trade evokes rather than by insertion order — pool/spa gets the
// water accent, pet care gets the nature/palm accent, tech gets the primary
// "official" accent, dining matches the forum's own Dining category (also
// amber — see src/lib/category-accent.ts), and the rest stay neutral.
const SERVICE_CATEGORY_ACCENT: Readonly<Record<ServiceCategory, CategoryAccent>> = {
  automotive: 'plum',
  beauty: 'amber',
  dining: 'amber',
  'home-services': 'plum',
  other: 'plum',
  'pet-care': 'palm',
  'pool-spa': 'lake',
  'tech-web': 'accent',
};

export function serviceCategoryAccent(category: ServiceCategory): CategoryAccent {
  return SERVICE_CATEGORY_ACCENT[category];
}

// Shown on a listing card/icon box when no logo has been uploaded, so every
// category reads as visually distinct at a glance instead of every listing
// showing the same generic storefront glyph.
const SERVICE_CATEGORY_ICON: Readonly<Record<ServiceCategory, AppIconName>> = {
  automotive: 'Car',
  beauty: 'Sparkles',
  dining: 'Utensils',
  'home-services': 'Wrench',
  other: 'Store',
  'pet-care': 'PawPrint',
  'pool-spa': 'Waves',
  'tech-web': 'Laptop',
};

export function serviceCategoryIcon(category: ServiceCategory): AppIconName {
  return SERVICE_CATEGORY_ICON[category];
}

export function serviceCategoryIconColor(category: ServiceCategory): string {
  return CATEGORY_ACCENT_ICON_COLOR[serviceCategoryAccent(category)];
}

import type { AppIconName } from '@/src/components/ui/icon';
import { CATEGORY_ACCENT_ICON_COLOR, type CategoryAccent } from '@/src/lib/category-accent';

import type { BusinessCategory } from './use-businesses';

// Deliberately its own set, independent of SERVICE_CATEGORIES (see
// service-category.ts) -- the user explicitly asked for the Businesses
// section to have its own filter pills, separate from Services'.
export const BUSINESS_CATEGORIES: readonly BusinessCategory[] = [
  'restaurants-bars',
  'goods',
  'hospitality',
  'professional-trade',
  'other',
];

export const BUSINESS_CATEGORY_LABEL: Readonly<Record<BusinessCategory, string>> = {
  goods: 'Goods',
  hospitality: 'Hospitality',
  other: 'Other',
  'professional-trade': 'Professional & Trade',
  'restaurants-bars': 'Restaurants & Bars',
};

const BUSINESS_CATEGORY_ACCENT: Readonly<Record<BusinessCategory, CategoryAccent>> = {
  goods: 'plum',
  hospitality: 'lake',
  other: 'palm',
  'professional-trade': 'accent',
  'restaurants-bars': 'amber',
};

export function businessCategoryAccent(category: BusinessCategory): CategoryAccent {
  return BUSINESS_CATEGORY_ACCENT[category];
}

// Shown on a listing card/icon box when no logo has been uploaded, mirroring
// service-category.ts's SERVICE_CATEGORY_ICON.
const BUSINESS_CATEGORY_ICON: Readonly<Record<BusinessCategory, AppIconName>> = {
  goods: 'Store',
  hospitality: 'Sparkles',
  other: 'HelpCircle',
  'professional-trade': 'Wrench',
  'restaurants-bars': 'Utensils',
};

export function businessCategoryIcon(category: BusinessCategory): AppIconName {
  return BUSINESS_CATEGORY_ICON[category];
}

export function businessCategoryIconColor(category: BusinessCategory): string {
  return CATEGORY_ACCENT_ICON_COLOR[businessCategoryAccent(category)];
}

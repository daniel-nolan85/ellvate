import type { ContactMessageCategory } from '@/src/backend/store';

export type { ContactMessageCategory } from '@/src/backend/store';

export const CONTACT_CATEGORIES: readonly ContactMessageCategory[] = [
  'bug',
  'feedback',
  'question',
  'other',
];

export type SubmitContactMessageResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly code: 'invalid_category' | 'invalid_message'; readonly message: string };

import type { PetitionCategory } from '@/src/backend/store';

import { PETITION_CATEGORIES, PETITION_DEADLINE_OPTIONS } from './types';

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 1500;

export interface ComposedPetition {
  readonly title: string;
  readonly description: string;
  readonly category: PetitionCategory;
  readonly deadlineDays: 7 | 14 | 30 | 60 | 90;
}

export type PetitionInputValidation =
  | { readonly ok: true; readonly value: ComposedPetition }
  | { readonly ok: false; readonly code: 'invalid_petition'; readonly message: string };

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const invalid = (message: string): PetitionInputValidation => ({
  code: 'invalid_petition',
  message,
  ok: false,
});

const isPetitionCategory = (value: unknown): value is PetitionCategory =>
  typeof value === 'string' && (PETITION_CATEGORIES as readonly string[]).includes(value);

const isDeadlineDays = (value: unknown): value is 7 | 14 | 30 | 60 | 90 =>
  typeof value === 'number' &&
  (PETITION_DEADLINE_OPTIONS as readonly number[]).includes(value);

export function validatePetitionInput(input: unknown): PetitionInputValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const title = asTrimmedString(raw.title);
  const description = asTrimmedString(raw.description);
  const category = raw.category;
  const deadlineDays = raw.deadlineDays;

  if (!title || !description) {
    return invalid('A title and description are required.');
  }
  if (title.length > MAX_TITLE) {
    return invalid('The title is too long.');
  }
  if (description.length > MAX_DESCRIPTION) {
    return invalid('The description is too long.');
  }
  if (!isPetitionCategory(category)) {
    return invalid('Choose a category.');
  }
  if (!isDeadlineDays(deadlineDays)) {
    return invalid('Choose how long the petition should run.');
  }

  return { ok: true, value: { category, deadlineDays, description, title } };
}

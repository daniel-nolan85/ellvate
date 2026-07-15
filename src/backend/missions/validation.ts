import type { MissionIcon } from '@/src/backend/store';
import { isDateOnly } from '@/src/lib/date-only';

import type { MissionValidation } from './types';

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 300;
const MIN_XP = 5;
const MAX_XP = 500;
const MIN_STOPS = 1;
const MAX_STOPS = 10;
const ICONS: readonly MissionIcon[] = ['Sun', 'ArrowUp', 'Star', 'Moon'];

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asInteger = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const invalid = (message: string): MissionValidation => ({
  code: 'invalid_mission',
  message,
  ok: false,
});

export function validateMissionInput(input: unknown): MissionValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const title = asTrimmedString(raw.title);
  const description = asTrimmedString(raw.description);
  const scheduledFor = asTrimmedString(raw.scheduledFor) || null;
  const xp = asInteger(raw.xp);
  const stopsTotal = asInteger(raw.stopsTotal);
  const icon = asTrimmedString(raw.icon) as MissionIcon;

  if (!title || !description) {
    return invalid('A title and description are required.');
  }
  if (title.length > MAX_TITLE || description.length > MAX_DESCRIPTION) {
    return invalid('A mission field exceeds its maximum length.');
  }
  if (scheduledFor !== null && !isDateOnly(scheduledFor)) {
    return invalid('Pick a valid mission day.');
  }
  if (xp === null || xp < MIN_XP || xp > MAX_XP) {
    return invalid(`XP must be a whole number between ${MIN_XP} and ${MAX_XP}.`);
  }
  if (stopsTotal === null || stopsTotal < MIN_STOPS || stopsTotal > MAX_STOPS) {
    return invalid(`Stops must be between ${MIN_STOPS} and ${MAX_STOPS}.`);
  }
  if (!ICONS.includes(icon)) {
    return invalid('Pick a valid icon.');
  }

  return {
    ok: true,
    value: { description, icon, scheduledFor, stopsTotal, title, xp },
  };
}

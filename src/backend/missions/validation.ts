import type { MissionTheme } from '@/src/backend/store';
import { isDateOnly } from '@/src/lib/date-only';

import type { MissionValidation } from './types';

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 500;
const MIN_XP = 5;
const MAX_XP = 500;
const MIN_STOPS = 1;
const MAX_STOPS = 10;
const MAX_STOP_LENGTH = 120;
const THEMES: readonly MissionTheme[] = [
  'trail',
  'water',
  'village',
  'day',
  'night',
  'social',
];

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asInteger = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

// WHY: returns null (not an empty array) for anything that isn't a proper
// array of non-empty strings, so the caller can distinguish "no stops sent"
// from "sent an empty/invalid list" and reject both the same way as a
// missing field, rather than silently treating malformed input as zero stops.
const asStopList = (value: unknown): readonly string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const stops = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return stops.length === value.length ? stops : null;
};

const invalid = (message: string): MissionValidation => ({
  code: 'invalid_mission',
  message,
  ok: false,
});

// Three-state: undefined ("stopIndex" omitted -- caller should default to the
// next not-yet-completed stop, preserving old sequential-only behavior for
// every existing caller), null (present but not a valid integer -- reject),
// or the requested index itself.
export function parseStopIndex(input: unknown): number | null | undefined {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  if (raw.stopIndex === undefined) {
    return undefined;
  }
  return asInteger(raw.stopIndex);
}

export function validateMissionInput(input: unknown): MissionValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const title = asTrimmedString(raw.title);
  const description = asTrimmedString(raw.description);
  const scheduledFor = asTrimmedString(raw.scheduledFor) || null;
  const xp = asInteger(raw.xp);
  const stops = asStopList(raw.stops);
  const themeRaw = asTrimmedString(raw.theme);
  const theme = themeRaw ? (themeRaw as MissionTheme) : null;

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
  if (stops === null || stops.length < MIN_STOPS || stops.length > MAX_STOPS) {
    return invalid(`Add between ${MIN_STOPS} and ${MAX_STOPS} stops.`);
  }
  if (stops.some((stop) => stop.length > MAX_STOP_LENGTH)) {
    return invalid(`Each stop must be under ${MAX_STOP_LENGTH} characters.`);
  }
  if (theme !== null && !THEMES.includes(theme)) {
    return invalid('Pick a valid mission theme.');
  }

  return {
    ok: true,
    value: {
      description,
      scheduledFor,
      stops,
      stopsTotal: stops.length,
      theme,
      title,
      xp,
    },
  };
}

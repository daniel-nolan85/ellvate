import type { ComposedEvent, EventValidation } from './types';

const MAX_TITLE = 100;
const MAX_PLACE = 100;
const MAX_TAG = 40;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const invalid = (message: string): EventValidation => ({
  code: 'invalid_event',
  message,
  ok: false,
});

const to12Hour = (time: string): string => {
  const [hh, mm] = time.split(':');
  const hour = Number(hh);
  const period = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${mm} ${period}`;
};

// The picked day and time are treated as the event's canonical display time (no
// timezone conversion), matching the seed convention, so the labels the UI shows
// are derived deterministically here rather than trusted from the client.
const composeEvent = (fields: {
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly date: string;
  readonly time: string;
}): ComposedEvent => {
  const { date, time } = fields;
  return {
    title: fields.title,
    place: fields.place,
    tag: fields.tag,
    startsAt: `${date}T${time}:00.000Z`,
    timeLabel: to12Hour(time),
    dayLabel: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()],
    dateLabel: String(Number(date.slice(8, 10))),
  };
};

export function validateEventInput(input: unknown): EventValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const title = asTrimmedString(raw.title);
  const place = asTrimmedString(raw.place);
  const tag = asTrimmedString(raw.tag);
  const date = asTrimmedString(raw.date);
  const time = asTrimmedString(raw.time);

  if (!title || !place || !tag) {
    return invalid('A title, place, and category are required.');
  }
  if (title.length > MAX_TITLE || place.length > MAX_PLACE || tag.length > MAX_TAG) {
    return invalid('An event field exceeds its maximum length.');
  }
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return invalid('Pick a valid day.');
  }
  if (!TIME_PATTERN.test(time)) {
    return invalid('Pick a valid time.');
  }

  return { ok: true, value: composeEvent({ date, place, tag, time, title }) };
}

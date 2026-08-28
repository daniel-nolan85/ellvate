// Every member is in Nevada, which observes Pacific time year-round (it
// never switches to Mountain), so this is the one zone that matters for
// "what week is this" -- and it's the same zone send_weekly_digest (see
// 0015/0042 migrations) anchors its own cron eligibility and window
// computation to. Using plain UTC here instead (the previous approach) drifts
// from that SQL computation by the UTC/Pacific offset (7-8 hours) around
// every week boundary -- e.g. for the first several hours of UTC Monday,
// Pacific is still Sunday, so a UTC-anchored "most recent completed week"
// jumps a week ahead of what the cron job (and every Pacific-based member)
// would call "last week".
const DIGEST_TZ = 'America/Los_Angeles';

interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
}

export interface WeekBounds {
  readonly start: Date;
  readonly end: Date;
  readonly weekStartIso: string;
  readonly weekEndIso: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

const calendarDateToIso = (date: CalendarDate): string =>
  `${date.year}-${pad(date.month)}-${pad(date.day)}`;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCalendarDate(value: string): CalendarDate | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  return { day: Number(match[3]), month: Number(match[2]), year: Number(match[1]) };
}

// Calendar-only arithmetic. `Date.UTC` is used purely as a Y/M/D calculator
// here (it correctly rolls month/year boundaries for an out-of-range day),
// never as a real instant -- the result is read back as Y/M/D, not as time.
function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const scratch = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    day: scratch.getUTCDate(),
    month: scratch.getUTCMonth() + 1,
    year: scratch.getUTCFullYear(),
  };
}

interface ZonedParts extends CalendarDate {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(instant);
  const lookup = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return {
    day: lookup('day'),
    hour: lookup('hour'),
    minute: lookup('minute'),
    month: lookup('month'),
    second: lookup('second'),
    year: lookup('year'),
  };
}

const zonedCalendarDate = (instant: Date, timeZone: string): CalendarDate =>
  zonedParts(instant, timeZone);

// The UTC instant whose wall-clock reading in `timeZone` is midnight on
// `date`. Solved by fixed-point iteration rather than a fixed offset table,
// so it stays correct across DST transitions: guess an instant, see what
// wall-clock time that guess actually displays as in `timeZone`, and correct
// the guess by the difference. The offset is constant everywhere except the
// transition instant itself, so this converges in at most two passes.
function zonedMidnightToUtc(date: CalendarDate, timeZone: string): Date {
  const targetAsUtc = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
  let guess = targetAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = zonedParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const errorMs = observedAsUtc - targetAsUtc;
    if (errorMs === 0) {
      break;
    }
    guess -= errorMs;
  }
  return new Date(guess);
}

// The public weekEnd field is the inclusive last day of the week (a Sunday)
// for display — "Jul 13 – Jul 19" reads correctly — while `end` stays the
// exclusive boundary (the following Monday) used for comparisons.
const inclusiveEndIso = (exclusiveEnd: CalendarDate): string =>
  calendarDateToIso(addCalendarDays(exclusiveEnd, -1));

// Pacific-local Monday 00:00 through the following Pacific-local Monday
// 00:00 (exclusive).
export function mostRecentCompletedWeek(referenceDate: Date): WeekBounds {
  const today = zonedCalendarDate(referenceDate, DIGEST_TZ);
  const isoWeekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const daysSinceMonday = (isoWeekday + 6) % 7;
  const thisMonday = addCalendarDays(today, -daysSinceMonday);
  const lastMonday = addCalendarDays(thisMonday, -7);
  return {
    end: zonedMidnightToUtc(thisMonday, DIGEST_TZ),
    start: zonedMidnightToUtc(lastMonday, DIGEST_TZ),
    weekEndIso: inclusiveEndIso(thisMonday),
    weekStartIso: calendarDateToIso(lastMonday),
  };
}

// Resolves the [start, end) window a digest should recap. With no explicit
// weekStart (the common case — opening the digest screen fresh), this is
// whichever Mon-Sun week most recently fully completed. An explicit
// weekStart (from a notification's deep-link payload) pins the digest to
// that specific week, so an old notification always reopens the week it was
// actually about rather than always jumping to "most recent". `weekStart` is
// a plain calendar date (YYYY-MM-DD) — it's read as a Pacific-local date,
// matching how send_weekly_digest computed it when the notification was
// created.
export function resolveWeekBounds(weekStart?: string): WeekBounds {
  if (!weekStart) {
    return mostRecentCompletedWeek(new Date());
  }
  const startDate = parseCalendarDate(weekStart);
  if (!startDate) {
    throw new Error(`resolveWeekBounds: invalid weekStart "${weekStart}"`);
  }
  const endDate = addCalendarDays(startDate, 7);
  return {
    end: zonedMidnightToUtc(endDate, DIGEST_TZ),
    start: zonedMidnightToUtc(startDate, DIGEST_TZ),
    weekEndIso: inclusiveEndIso(endDate),
    weekStartIso: weekStart,
  };
}

// The [start, end) window for "coming up" — always the real, current next 7
// Pacific-local days, independent of which week's recap is being viewed.
export function nextSevenDaysBounds(referenceDate: Date = new Date()): {
  readonly start: Date;
  readonly end: Date;
} {
  const today = zonedCalendarDate(referenceDate, DIGEST_TZ);
  return {
    end: zonedMidnightToUtc(addCalendarDays(today, 7), DIGEST_TZ),
    start: zonedMidnightToUtc(today, DIGEST_TZ),
  };
}

export function isWithin(iso: string, start: Date, end: Date): boolean {
  const value = Date.parse(iso);
  return value >= start.getTime() && value < end.getTime();
}

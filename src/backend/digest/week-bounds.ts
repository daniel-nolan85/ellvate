const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeekBounds {
  readonly start: Date;
  readonly end: Date;
  readonly weekStartIso: string;
  readonly weekEndIso: string;
}

const toDateOnlyIso = (date: Date): string => date.toISOString().slice(0, 10);

// The public weekEnd field is the inclusive last day of the week (a Sunday)
// for display — "Jul 13 – Jul 19" reads correctly — while `end` stays the
// exclusive boundary (the following Monday) used for comparisons.
const inclusiveEndIso = (exclusiveEnd: Date): string =>
  toDateOnlyIso(new Date(exclusiveEnd.getTime() - DAY_MS));

// Monday 00:00 UTC through the following Monday 00:00 UTC (exclusive) — a
// plain UTC week, not anchored to a specific timezone. The scheduled digest
// notification (see 0015_weekly_digest.sql) does need Pacific-local
// awareness to fire at the right wall-clock hour, but scoping which items
// count as "last week" is far less sensitive to a few hours of skew, so this
// stays consistent with how the rest of the app's TS code handles dates —
// plain UTC, no IANA timezone conversion.
export function mostRecentCompletedWeek(referenceDate: Date): WeekBounds {
  const day = referenceDate.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const thisMonday = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() - daysSinceMonday,
    ),
  );
  const lastMonday = new Date(thisMonday.getTime() - 7 * DAY_MS);
  return {
    end: thisMonday,
    start: lastMonday,
    weekEndIso: inclusiveEndIso(thisMonday),
    weekStartIso: toDateOnlyIso(lastMonday),
  };
}

// Resolves the [start, end) window a digest should recap. With no explicit
// weekStart (the common case — opening the digest screen fresh), this is
// whichever Mon-Sun week most recently fully completed. An explicit
// weekStart (from a notification's deep-link payload) pins the digest to
// that specific week, so an old notification always reopens the week it was
// actually about rather than always jumping to "most recent".
export function resolveWeekBounds(weekStart?: string): WeekBounds {
  if (!weekStart) {
    return mostRecentCompletedWeek(new Date());
  }
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return { end, start, weekEndIso: inclusiveEndIso(end), weekStartIso: weekStart };
}

// The [start, end) window for "coming up" — always the real, current next 7
// days, independent of which week's recap is being viewed.
export function nextSevenDaysBounds(referenceDate: Date = new Date()): {
  readonly start: Date;
  readonly end: Date;
} {
  const start = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return { end, start };
}

export function isWithin(iso: string, start: Date, end: Date): boolean {
  const value = Date.parse(iso);
  return value >= start.getTime() && value < end.getTime();
}

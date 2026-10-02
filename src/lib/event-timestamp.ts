// Events' startsAt/endsAt are composed server-side from plain date+time
// digits with a literal "Z" suffix and no real timezone conversion (see
// validateEventInput's composeEvent in src/backend/events/validation.ts) --
// the "Z" doesn't mean the value is actually UTC, it's a wall-clock value
// wearing a UTC label. Parsing one of these strings with a plain
// `new Date(iso)` and then reading local getters off it (exactly what a
// native date/time picker does to decide what to display) silently shifts
// the shown value by the device's UTC offset -- e.g. a 5:15 PM event reads
// back as 10:15 AM for a UTC-7 device. Reading the UTC getters instead
// pulls the original digits back out exactly as composeEvent wrote them,
// then rebuilds a local Date carrying those same numbers, so a native
// picker's local getters show what was actually typed in.
export function parseEventTimestamp(iso: string): Date {
  const naive = new Date(iso);
  return new Date(
    naive.getUTCFullYear(),
    naive.getUTCMonth(),
    naive.getUTCDate(),
    naive.getUTCHours(),
    naive.getUTCMinutes(),
    0,
    0,
  );
}

import { describe, expect, test } from 'bun:test';

import { parseEventTimestamp } from './event-timestamp';

describe('parseEventTimestamp', () => {
  test('reads the local-looking digits back out, ignoring the device timezone', () => {
    const result = parseEventTimestamp('2026-10-01T17:15:00.000Z');

    // These are local getters -- the whole point of the function is that
    // they return the same digits the ISO string's "Z"-suffixed value
    // carries, not those digits shifted by whatever timezone this test
    // happens to run under.
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(17);
    expect(result.getMinutes()).toBe(15);
  });

  test('round-trips through dateOnlyFromDate/timeOnlyFromDate unchanged', async () => {
    const { dateOnlyFromDate } = await import('./date-only');
    const { timeOnlyFromDate } = await import('./time-only');
    const iso = '2026-01-05T09:30:00.000Z';

    const result = parseEventTimestamp(iso);

    expect(dateOnlyFromDate(result)).toBe('2026-01-05');
    expect(timeOnlyFromDate(result)).toBe('09:30');
  });

  test('handles midnight and end-of-month digits correctly', () => {
    const result = parseEventTimestamp('2026-12-31T00:00:00.000Z');

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(31);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

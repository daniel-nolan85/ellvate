import { describe, expect, it } from 'bun:test';

import {
  isTimeOnly,
  timeOnlyFromDate,
  timeOnlyToDate,
} from '../../src/lib/time-only';

describe('time-only values', () => {
  it('serializes local picker values without timezone conversion', () => {
    expect(timeOnlyFromDate(new Date(2026, 6, 14, 9, 5))).toBe('09:05');
  });

  it('parses valid 24-hour values onto the supplied day', () => {
    const value = timeOnlyToDate('23:45', new Date(2026, 6, 14));

    expect(value?.getFullYear()).toBe(2026);
    expect(value?.getMonth()).toBe(6);
    expect(value?.getDate()).toBe(14);
    expect(value?.getHours()).toBe(23);
    expect(value?.getMinutes()).toBe(45);
  });

  it('rejects malformed and out-of-range values', () => {
    expect(isTimeOnly('9:05')).toBe(false);
    expect(isTimeOnly('24:00')).toBe(false);
    expect(isTimeOnly('10:60')).toBe(false);
  });
});

import { describe, expect, test } from 'bun:test';

import {
  dateOnlyFromDate,
  dateOnlyToDate,
  formatDateOnly,
  isDateOnly,
} from '../../src/lib/date-only';

describe('date-only values', () => {
  test('round-trips a local calendar day without a timezone shift', () => {
    const date = dateOnlyToDate('2026-07-18');

    expect(date).not.toBeNull();
    expect(dateOnlyFromDate(date!)).toBe('2026-07-18');
    expect(formatDateOnly('2026-07-18')).toBe('Jul 18, 2026');
  });

  test('rejects normalized and malformed dates', () => {
    expect(isDateOnly('2026-02-29')).toBe(false);
    expect(isDateOnly('2028-02-29')).toBe(true);
    expect(isDateOnly('2026-02-31')).toBe(false);
    expect(isDateOnly('07/18/2026')).toBe(false);
  });
});

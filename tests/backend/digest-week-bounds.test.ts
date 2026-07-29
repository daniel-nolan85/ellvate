import { describe, expect, test } from 'bun:test';

import {
  isWithin,
  mostRecentCompletedWeek,
  nextSevenDaysBounds,
  resolveWeekBounds,
} from '../../src/backend/digest/week-bounds';

describe('mostRecentCompletedWeek', () => {
  test('resolves to the prior Mon-Sun week when "now" is a Wednesday', () => {
    // 2026-01-14 is a Wednesday.
    const bounds = mostRecentCompletedWeek(new Date('2026-01-14T15:00:00.000Z'));
    expect(bounds.weekStartIso).toBe('2026-01-05');
    expect(bounds.weekEndIso).toBe('2026-01-11');
    expect(bounds.start.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-01-12T00:00:00.000Z');
  });

  test('resolves the same prior week when "now" is itself a Monday', () => {
    // 2026-01-12 is a Monday — the just-started week should not count as
    // "completed"; the digest should still show the week before it.
    const bounds = mostRecentCompletedWeek(new Date('2026-01-12T08:00:00.000Z'));
    expect(bounds.weekStartIso).toBe('2026-01-05');
    expect(bounds.weekEndIso).toBe('2026-01-11');
  });

  test('resolves correctly when "now" is a Sunday', () => {
    // 2026-01-11 is a Sunday, the last day of the week starting 2026-01-05.
    const bounds = mostRecentCompletedWeek(new Date('2026-01-11T23:00:00.000Z'));
    expect(bounds.weekStartIso).toBe('2025-12-29');
    expect(bounds.weekEndIso).toBe('2026-01-04');
  });
});

describe('resolveWeekBounds', () => {
  test('with no weekStart, defers to mostRecentCompletedWeek(now)', () => {
    const bounds = resolveWeekBounds();
    // Whatever "now" resolves to, start must be a full 7 days before the
    // (exclusive) end, and both must be date-only ISO strings.
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(bounds.weekStartIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('with an explicit weekStart, pins the window to that date regardless of "now"', () => {
    const bounds = resolveWeekBounds('2020-03-02');
    expect(bounds.weekStartIso).toBe('2020-03-02');
    expect(bounds.weekEndIso).toBe('2020-03-08');
    expect(bounds.start.toISOString()).toBe('2020-03-02T00:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2020-03-09T00:00:00.000Z');
  });
});

describe('nextSevenDaysBounds', () => {
  test('spans exactly 7 days starting today', () => {
    const bounds = nextSevenDaysBounds(new Date('2026-01-14T15:30:00.000Z'));
    expect(bounds.start.toISOString()).toBe('2026-01-14T00:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-01-21T00:00:00.000Z');
  });
});

describe('isWithin', () => {
  const start = new Date('2026-01-05T00:00:00.000Z');
  const end = new Date('2026-01-12T00:00:00.000Z');

  test('is inclusive of start and exclusive of end', () => {
    expect(isWithin('2026-01-05T00:00:00.000Z', start, end)).toBe(true);
    expect(isWithin('2026-01-11T23:59:59.999Z', start, end)).toBe(true);
    expect(isWithin('2026-01-12T00:00:00.000Z', start, end)).toBe(false);
    expect(isWithin('2026-01-04T23:59:59.999Z', start, end)).toBe(false);
  });
});

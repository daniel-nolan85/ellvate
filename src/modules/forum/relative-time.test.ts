import { describe, expect, test } from 'bun:test';

import { formatRelativeTime } from './relative-time';

const NOW = new Date('2026-07-12T12:00:00.000Z');

describe('formatRelativeTime', () => {
  test('reports "now" for anything under a minute old', () => {
    expect(formatRelativeTime('2026-07-12T12:00:00.000Z', NOW)).toBe('now');
    expect(formatRelativeTime('2026-07-12T11:59:30.000Z', NOW)).toBe('now');
  });

  test('treats future timestamps as "now"', () => {
    expect(formatRelativeTime('2026-07-12T13:00:00.000Z', NOW)).toBe('now');
  });

  test('formats minutes, hours, days, and weeks with floor rounding', () => {
    expect(formatRelativeTime('2026-07-12T11:45:00.000Z', NOW)).toBe('15m');
    expect(formatRelativeTime('2026-07-12T11:00:00.000Z', NOW)).toBe('1h');
    expect(formatRelativeTime('2026-07-12T09:00:00.000Z', NOW)).toBe('3h');
    expect(formatRelativeTime('2026-07-11T12:00:00.000Z', NOW)).toBe('1d');
    expect(formatRelativeTime('2026-07-10T12:00:00.000Z', NOW)).toBe('2d');
    expect(formatRelativeTime('2026-06-28T12:00:00.000Z', NOW)).toBe('2w');
  });

  test('falls back to "now" for unparseable input', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('now');
  });
});

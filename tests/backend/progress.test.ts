import { describe, expect, test } from 'bun:test';

import { computeProgress, LEVEL_XP_SPAN } from '../../src/backend/progress';

describe('computeProgress', () => {
  test('0 XP starts at level 1 with a full level remaining', () => {
    expect(computeProgress(0)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForNextLevel: 300,
      xpToNextLevel: 300,
    });
  });

  test('299 XP stays on level 1 with 1 XP remaining', () => {
    expect(computeProgress(299)).toEqual({
      level: 1,
      xpIntoLevel: 299,
      xpForNextLevel: 300,
      xpToNextLevel: 1,
    });
  });

  test('300 XP rolls over to level 2', () => {
    expect(computeProgress(300)).toEqual({
      level: 2,
      xpIntoLevel: 0,
      xpForNextLevel: 300,
      xpToNextLevel: 300,
    });
  });

  test('seed demo-user 1980 XP is level 7, 180 into level, 120 to next', () => {
    expect(computeProgress(1980)).toEqual({
      level: 7,
      xpIntoLevel: 180,
      xpForNextLevel: 300,
      xpToNextLevel: 120,
    });
  });

  test('large XP values keep the flat curve', () => {
    expect(computeProgress(3_000_000)).toEqual({
      level: 10_001,
      xpIntoLevel: 0,
      xpForNextLevel: 300,
      xpToNextLevel: 300,
    });
    expect(computeProgress(3_000_299).level).toBe(10_001);
    expect(computeProgress(3_000_299).xpToNextLevel).toBe(1);
  });

  test('clamps negative and non-integer input', () => {
    expect(computeProgress(-50)).toEqual(computeProgress(0));
    expect(computeProgress(299.9)).toEqual(computeProgress(299));
  });

  test('exposes the flat level span constant', () => {
    expect(LEVEL_XP_SPAN).toBe(300);
  });
});

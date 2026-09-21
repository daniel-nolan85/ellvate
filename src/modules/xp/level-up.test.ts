import { describe, expect, test } from 'bun:test';

import { computeLeveledUpTo, computeRankedUpTo } from './level-up';

describe('computeLeveledUpTo', () => {
  test('returns the new level when it is higher than the previous level', () => {
    expect(computeLeveledUpTo(3, 4)).toBe(4);
  });

  test('returns null when the level did not change', () => {
    expect(computeLeveledUpTo(3, 3)).toBeNull();
  });

  test('returns null when there was no cached previous level', () => {
    expect(computeLeveledUpTo(undefined, 4)).toBeNull();
  });

  test('returns null if the new level is somehow lower (defensive, should not happen)', () => {
    expect(computeLeveledUpTo(5, 4)).toBeNull();
  });
});

describe('computeRankedUpTo', () => {
  test('returns the new tier title when crossing a rank boundary', () => {
    // Level 6 is Lake Local, level 7 is Lake Regular.
    expect(computeRankedUpTo(6, 7)).toBe('Lake Regular');
  });

  test('returns null when leveling up within the same rank tier', () => {
    // Levels 7-14 are all Lake Regular.
    expect(computeRankedUpTo(7, 8)).toBeNull();
  });

  test('returns null when the level did not change', () => {
    expect(computeRankedUpTo(7, 7)).toBeNull();
  });

  test('returns null when there was no cached previous level', () => {
    expect(computeRankedUpTo(undefined, 7)).toBeNull();
  });

  test('returns null if the new level is somehow lower (defensive, should not happen)', () => {
    expect(computeRankedUpTo(7, 6)).toBeNull();
  });

  test('returns the new tier title when jumping across multiple rank boundaries at once', () => {
    // A big XP grant could cross more than one tier in a single check-in.
    expect(computeRankedUpTo(6, 25)).toBe('Lake Champion');
  });
});

import { describe, expect, test } from 'bun:test';

import { computeProgress, LEVEL_XP_BASE, LEVEL_XP_CAP } from '../../src/backend/progress';

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

  test('300 XP rolls over to level 2, which costs more than level 1', () => {
    expect(computeProgress(300)).toEqual({
      level: 2,
      xpIntoLevel: 0,
      xpForNextLevel: 315,
      xpToNextLevel: 315,
    });
  });

  test('each level costs a bit more than the last, pre-cap', () => {
    // Spans: L1=300, L2=315, L3=331, L4=347, L5=365 -- a 5% compounding
    // climb off the 300 XP base, each one individually rounded.
    expect(computeProgress(300).xpForNextLevel).toBe(315);
    expect(computeProgress(615).xpForNextLevel).toBe(331);
    expect(computeProgress(946).xpForNextLevel).toBe(347);
    expect(computeProgress(1293).xpForNextLevel).toBe(365);
  });

  test('1980 XP lands mid level 6 under the compounding curve', () => {
    // cum(5) = 300+315+331+347+365 = 1658 XP to clear levels 1-5.
    // Level 6 costs 383, so 1980 XP is 322 into it, 61 short of level 7.
    expect(computeProgress(1980)).toEqual({
      level: 6,
      xpIntoLevel: 322,
      xpForNextLevel: 383,
      xpToNextLevel: 61,
    });
  });

  test('span growth stops at the cap and stays flat from then on', () => {
    // Level 23 still costs 878 (under the 900 cap); level 24 would compute
    // to ~921 uncapped, so it clamps to exactly 900 -- and every level
    // after that costs the same flat 900.
    expect(computeProgress(12431)).toEqual({
      level: 24,
      xpIntoLevel: 0,
      xpForNextLevel: LEVEL_XP_CAP,
      xpToNextLevel: LEVEL_XP_CAP,
    });
    expect(computeProgress(12431 + LEVEL_XP_CAP).level).toBe(25);
    expect(computeProgress(12431 + LEVEL_XP_CAP).xpForNextLevel).toBe(LEVEL_XP_CAP);
  });

  test('large XP values climb at the flat capped rate without looping level by level', () => {
    // 20,000 XP is 7,569 past the level-24 threshold (12,431); at a flat
    // 900/level that's 8 full levels (7,200) plus 369 into the 9th.
    expect(computeProgress(20_000)).toEqual({
      level: 32,
      xpIntoLevel: 369,
      xpForNextLevel: LEVEL_XP_CAP,
      xpToNextLevel: LEVEL_XP_CAP - 369,
    });
  });

  test('clamps negative and non-integer input', () => {
    expect(computeProgress(-50)).toEqual(computeProgress(0));
    expect(computeProgress(299.9)).toEqual(computeProgress(299));
  });

  test('exposes the base level span constant', () => {
    expect(LEVEL_XP_BASE).toBe(300);
  });
});

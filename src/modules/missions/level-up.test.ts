import { describe, expect, test } from 'bun:test';

import { computeLeveledUpTo } from './level-up';

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

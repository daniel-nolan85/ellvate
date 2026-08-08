import { describe, expect, test } from 'bun:test';

import { subforumsForInterests } from './interest-subforum-map';

describe('subforumsForInterests', () => {
  test('groups multiple interests onto the same subforum', () => {
    expect(subforumsForInterests(['Boating & marina', 'Paddle sports'])).toEqual(
      new Set(['Marina & Boating']),
    );
    expect(subforumsForInterests(['Dining out', 'Wine & tastings'])).toEqual(
      new Set(['Dining']),
    );
  });

  test('maps the new Pickleball & tennis and Volunteering interests', () => {
    expect(subforumsForInterests(['Pickleball & tennis'])).toEqual(
      new Set(['Sports Club']),
    );
    expect(subforumsForInterests(['Volunteering'])).toEqual(
      new Set(['Announcements']),
    );
  });

  test('leaves interests with no matching subforum out of the result', () => {
    expect(
      subforumsForInterests(['Family things', 'Photography', 'Book club']),
    ).toEqual(new Set());
  });

  test('returns a set with one entry per matched subforum, not one per interest', () => {
    const result = subforumsForInterests([
      'Golf',
      'Dining out',
      'Wine & tastings',
    ]);
    expect(result).toEqual(new Set(['Golf', 'Dining']));
  });
});

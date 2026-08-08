import { describe, expect, test } from 'bun:test';

import { safeCursorOrFilter } from '../../src/backend/forum/posts-supabase';

describe('safeCursorOrFilter', () => {
  test('returns null when there is no cursor', () => {
    expect(safeCursorOrFilter(null)).toBeNull();
  });

  test('builds a keyset filter for a well-formed cursor', () => {
    const filter = safeCursorOrFilter({
      id: 'post-123',
      sortKey: '2026-08-05T12:34:56.789Z',
    });

    expect(filter).toBe(
      'created_at.lt.2026-08-05T12:34:56.789Z,and(created_at.eq.2026-08-05T12:34:56.789Z,id.lt.post-123)',
    );
  });

  test('accepts a timezone-offset timestamp as well as a Z suffix', () => {
    const filter = safeCursorOrFilter({
      id: 'post-123',
      sortKey: '2026-08-05T12:34:56.789012+00:00',
    });

    expect(filter).not.toBeNull();
  });

  // Regression test: the cursor is client-supplied (round-tripped through a
  // query param), and used to get spliced raw into a PostgREST `.or()`
  // filter string. PostgREST treats `,`, `(`, and `)` as structural filter
  // delimiters, so a crafted sortKey/id could inject extra conditions.
  test('rejects a sortKey or id containing PostgREST filter delimiters', () => {
    expect(
      safeCursorOrFilter({
        id: 'post-1',
        sortKey: '2026-08-05T12:34:56.789Z,or(id.eq.post-2',
      }),
    ).toBeNull();

    expect(
      safeCursorOrFilter({
        id: 'post-1),or(author_id.eq.someone-else',
        sortKey: '2026-08-05T12:34:56.789Z',
      }),
    ).toBeNull();
  });

  test('rejects a sortKey that is not a plausible timestamp', () => {
    expect(safeCursorOrFilter({ id: 'post-1', sortKey: 'not-a-date' })).toBeNull();
  });

  test('rejects an id containing characters outside the safe set', () => {
    expect(
      safeCursorOrFilter({ id: 'post 1; drop table posts', sortKey: '2026-08-05T12:34:56Z' }),
    ).toBeNull();
  });
});

import { describe, expect, test } from 'bun:test';

import {
  compareCursorOrder,
  decodeCursor,
  encodeCursor,
  paginateInMemory,
} from './cursor-pagination';

describe('encodeCursor / decodeCursor', () => {
  test('round-trips a sortKey and id', () => {
    const cursor = encodeCursor({ id: 'item-1', sortKey: '2026-07-20T00:00:00.000Z' });
    expect(decodeCursor(cursor)).toEqual({
      id: 'item-1',
      sortKey: '2026-07-20T00:00:00.000Z',
    });
  });

  test('returns null for a malformed cursor', () => {
    expect(decodeCursor('not-a-real-cursor')).toBeNull();
  });

  test('round-trips a zero-padded integer sortKey (missions use array position, not a date)', () => {
    const cursor = encodeCursor({ id: 'mission-1', sortKey: '0000000003' });
    expect(decodeCursor(cursor)).toEqual({ id: 'mission-1', sortKey: '0000000003' });
  });
});

describe('compareCursorOrder', () => {
  test('orders descending by sortKey', () => {
    const older = { id: 'a', sortKey: '2026-07-01T00:00:00.000Z' };
    const newer = { id: 'b', sortKey: '2026-07-02T00:00:00.000Z' };
    expect(compareCursorOrder(newer, older)).toBeLessThan(0);
    expect(compareCursorOrder(older, newer)).toBeGreaterThan(0);
  });

  test('breaks ties on id when sortKey is equal', () => {
    const a = { id: 'aaa', sortKey: '2026-07-01T00:00:00.000Z' };
    const b = { id: 'bbb', sortKey: '2026-07-01T00:00:00.000Z' };
    // Descending by id on ties: 'bbb' sorts before 'aaa'.
    expect(compareCursorOrder(b, a)).toBeLessThan(0);
    expect(compareCursorOrder(a, a)).toBe(0);
  });
});

describe('paginateInMemory', () => {
  const items = [
    { id: '1', sortKey: '2026-07-01T00:00:00.000Z' },
    { id: '2', sortKey: '2026-07-02T00:00:00.000Z' },
    { id: '3', sortKey: '2026-07-03T00:00:00.000Z' },
  ];

  test('returns an empty page with no cursor for an empty input', () => {
    expect(paginateInMemory([], 20, null)).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  test('sorts newest-first when no cursor is given', () => {
    const page = paginateInMemory(items, 20, null);
    expect(page.items.map((item) => item.id)).toEqual(['3', '2', '1']);
    expect(page.nextCursor).toBeNull();
  });

  test('returns a nextCursor exactly when more items remain', () => {
    const page = paginateInMemory(items, 2, null);
    expect(page.items.map((item) => item.id)).toEqual(['3', '2']);
    expect(page.nextCursor).not.toBeNull();
  });

  test('has no nextCursor when the page exactly fills the remaining items', () => {
    const page = paginateInMemory(items, 3, null);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  test('resumes correctly from a previous page\'s cursor', () => {
    const firstPage = paginateInMemory(items, 2, null);
    const secondPage = paginateInMemory(items, 2, firstPage.nextCursor);
    expect(secondPage.items.map((item) => item.id)).toEqual(['1']);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('returns an empty page when the cursor is past the last item', () => {
    const lastPage = paginateInMemory(items, 20, null);
    const cursor = encodeCursor(lastPage.items[lastPage.items.length - 1]!);
    expect(paginateInMemory(items, 20, cursor)).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  test('treats an unparseable cursor as no cursor rather than throwing', () => {
    const page = paginateInMemory(items, 20, 'garbage-cursor-value');
    expect(page.items.map((item) => item.id)).toEqual(['3', '2', '1']);
  });
});

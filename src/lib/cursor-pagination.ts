export interface CursorItem {
  readonly sortKey: string;
  readonly id: string;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

const SEPARATOR = '::';

export function encodeCursor(item: CursorItem): string {
  return `${item.sortKey}${SEPARATOR}${item.id}`;
}

export function decodeCursor(cursor: string): CursorItem | null {
  const separatorIndex = cursor.indexOf(SEPARATOR);
  if (separatorIndex === -1) {
    return null;
  }
  return {
    id: cursor.slice(separatorIndex + SEPARATOR.length),
    sortKey: cursor.slice(0, separatorIndex),
  };
}

// Descending by sortKey, then by id — an arbitrary but stable tiebreak so two
// items with the same sortKey still sort consistently across pages. Plain
// lexicographic comparison rather than `Date.parse`: ISO-8601 timestamps sort
// correctly as plain strings, and this also lets callers use other naturally
// sortable strings (e.g. a zero-padded integer) as the sort key.
export function compareCursorOrder(a: CursorItem, b: CursorItem): number {
  if (a.sortKey !== b.sortKey) {
    return a.sortKey < b.sortKey ? 1 : -1;
  }
  return b.id.localeCompare(a.id);
}

// Paginates an already-fetched, already-filtered array. Used directly by the
// in-memory backend, and by Supabase backends that must merge more than one
// query (e.g. "created by me" + "joined by me", which can't be expressed as
// a single keyset-limited query) before taking a single page from the result.
export function paginateInMemory<T extends CursorItem>(
  items: readonly T[],
  limit: number,
  cursor: string | null,
): CursorPage<T> {
  const parsedCursor = cursor ? decodeCursor(cursor) : null;
  const sorted = items.slice().sort(compareCursorOrder);
  const startIndex = parsedCursor
    ? sorted.findIndex((item) => compareCursorOrder(item, parsedCursor) > 0)
    : 0;
  const from = startIndex === -1 ? sorted.length : startIndex;
  const page = sorted.slice(from, from + limit);
  const nextCursor =
    from + limit < sorted.length ? encodeCursor(page[page.length - 1]!) : null;
  return { items: page, nextCursor };
}

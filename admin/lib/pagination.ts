export const LIST_PAGE_SIZE = 30;

export interface CursorItem {
  readonly sortKey: string;
  readonly id: string;
}

const SEPARATOR = '::';

export function encodeCursor(item: CursorItem): string {
  return `${item.sortKey}${SEPARATOR}${item.id}`;
}

export function decodeCursor(cursor: string | undefined): CursorItem | null {
  if (!cursor) {
    return null;
  }
  const index = cursor.indexOf(SEPARATOR);
  if (index === -1) {
    return null;
  }
  return {
    sortKey: cursor.slice(0, index),
    id: cursor.slice(index + SEPARATOR.length),
  };
}

interface OrFilterable {
  or(filters: string): this;
}

// Keyset pagination for the common case: a single column sorted
// descending, tiebroken by id descending (e.g. `created_at desc, id desc`).
export function applyDescCursor<Q extends OrFilterable>(
  query: Q,
  sortColumn: string,
  idColumn: string,
  cursor: string | undefined,
): Q {
  const parsed = decodeCursor(cursor);
  if (!parsed) {
    return query;
  }
  return query.or(
    `${sortColumn}.lt.${parsed.sortKey},and(${sortColumn}.eq.${parsed.sortKey},${idColumn}.lt.${parsed.id})`,
  );
}

// Same as applyDescCursor but for a column sorted ascending (missions'
// `position`, which has no natural descending "newest first" reading).
export function applyAscCursor<Q extends OrFilterable>(
  query: Q,
  sortColumn: string,
  idColumn: string,
  cursor: string | undefined,
): Q {
  const parsed = decodeCursor(cursor);
  if (!parsed) {
    return query;
  }
  return query.or(
    `${sortColumn}.gt.${parsed.sortKey},and(${sortColumn}.eq.${parsed.sortKey},${idColumn}.gt.${parsed.id})`,
  );
}

// supabase-js does not escape `,`/`(`/`)` before interpolating into a
// PostgREST `.or()` filter string -- a raw comma or paren in a user's
// search term would corrupt the filter syntax rather than just fail to
// match. Strip them before building any `.or()` search filter. Not needed
// for plain `.ilike()` single-column searches, which are parameterized.
export function escapeOrSearchTerm(term: string): string {
  return term.replace(/[,()]/g, '');
}

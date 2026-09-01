export type SearchResultKind = 'post' | 'event' | 'mission' | 'service' | 'petition';

export interface SearchResultItem {
  readonly id: string;
  readonly kind: SearchResultKind;
  readonly title: string;
  readonly subtitle: string;
}

export interface GlobalSearchResults {
  readonly posts: readonly SearchResultItem[];
  readonly events: readonly SearchResultItem[];
  readonly missions: readonly SearchResultItem[];
  readonly services: readonly SearchResultItem[];
  readonly petitions: readonly SearchResultItem[];
}

// Per-group cap -- a search result sheet is a jump-to-it list, not a full
// paginated feed, so each group only needs enough rows to recognize the
// thing you're looking for.
export const SEARCH_RESULTS_PER_GROUP = 5;

// Below this length a query is too broad to be useful (and, server-side, too
// cheap to abuse against five tables at once) -- mirrors the client's own
// debounce-and-guard before it ever calls the endpoint.
export const MIN_SEARCH_QUERY_LENGTH = 2;

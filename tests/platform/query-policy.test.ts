import { describe, expect, test } from 'bun:test';
import type { Query } from '@tanstack/react-query';

import {
  createAppQueryClient,
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_STALE_TIME_MS,
  shouldPersistQuery,
} from '../../src/platform/query';

const buildSuccessfulQuery = (
  meta?: { persist?: boolean; sensitive?: boolean },
): Query => {
  const client = createAppQueryClient();
  const query = client.getQueryCache().build(client, {
    meta,
    queryFn: async () => ({ ok: true }),
    queryKey: ['test', meta ?? 'unmarked'],
  });

  query.setData({ ok: true });
  return query as unknown as Query;
};

describe('TanStack server-state policy', () => {
  test('uses the documented cache defaults', () => {
    const client = createAppQueryClient();
    const queryDefaults = client.getDefaultOptions().queries;
    const mutationDefaults = client.getDefaultOptions().mutations;

    expect(queryDefaults?.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(queryDefaults?.gcTime).toBe(QUERY_CACHE_MAX_AGE_MS);
    expect(queryDefaults?.retry).toBe(2);
    expect(mutationDefaults?.retry).toBe(false);
  });

  test('persists only explicitly approved, non-sensitive successful queries', () => {
    expect(shouldPersistQuery(buildSuccessfulQuery({ persist: true }))).toBe(true);
    expect(shouldPersistQuery(buildSuccessfulQuery())).toBe(false);
    expect(shouldPersistQuery(buildSuccessfulQuery({
      persist: true,
      sensitive: true,
    }))).toBe(false);
  });
});

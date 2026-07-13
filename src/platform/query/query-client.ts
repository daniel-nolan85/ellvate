import './query-meta'

import { QueryClient } from '@tanstack/react-query'

import {
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_STALE_TIME_MS,
} from './constants'

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: QUERY_CACHE_MAX_AGE_MS,
        networkMode: 'online',
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: 2,
        staleTime: QUERY_STALE_TIME_MS,
      },
      mutations: {
        networkMode: 'online',
        retry: false,
      },
    },
  })
}

/** Stable client used by the production provider. */
export const queryClient = createAppQueryClient()

/**
 * Isolated client for tests. A fresh instance should be created for each test.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

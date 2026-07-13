import './query-meta'

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import {
  defaultShouldDehydrateQuery,
  type Query,
} from '@tanstack/react-query'
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client'

import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_CACHE_STORAGE_KEY,
} from './constants'
import { queryClient } from './query-client'

type PersisterStorage = Parameters<
  typeof createAsyncStoragePersister
>[0]['storage']

export function shouldPersistQuery(query: Query): boolean {
  return (
    defaultShouldDehydrateQuery(query) &&
    query.meta?.persist === true &&
    query.meta.sensitive !== true
  )
}

export function createQueryPersistence(storage: PersisterStorage) {
  const queryPersister = createAsyncStoragePersister({
    key: QUERY_CACHE_STORAGE_KEY,
    storage,
    throttleTime: 1_000,
  })

  const queryPersistOptions: PersistQueryClientProviderProps['persistOptions'] =
    {
      buster: QUERY_CACHE_BUSTER,
      dehydrateOptions: {
        shouldDehydrateMutation: () => false,
        shouldDehydrateQuery: shouldPersistQuery,
      },
      maxAge: QUERY_CACHE_MAX_AGE_MS,
      persister: queryPersister,
    }

  /**
   * Cancels active reads, clears the in-memory client, and removes its device
   * snapshot. Use this when the authenticated user or tenant boundary changes.
   */
  async function clearQueryCache(): Promise<void> {
    await queryClient.cancelQueries()
    queryClient.clear()
    await queryPersister.removeClient()
  }

  return {
    clearQueryCache,
    queryPersister,
    queryPersistOptions,
  }
}

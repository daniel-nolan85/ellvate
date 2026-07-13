import {
  createQueryPersistence,
  shouldPersistQuery,
} from './persistence.shared'

/**
 * Non-Metro test fallback. Native and web bundles resolve their platform files,
 * while plain test runners can import the public barrel without native modules.
 */
export const {
  clearQueryCache,
  queryPersister,
  queryPersistOptions,
} = createQueryPersistence(undefined)

export { shouldPersistQuery }

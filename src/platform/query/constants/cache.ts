const MINUTE_MS = 60 * 1_000
const HOUR_MS = 60 * MINUTE_MS

export const QUERY_STALE_TIME_MS = MINUTE_MS
export const QUERY_CACHE_MAX_AGE_MS = 24 * HOUR_MS

/**
 * Bump this value when an OTA update changes persisted query keys, response
 * shapes, serialization, or tenant boundaries in a backwards-incompatible way.
 */
export const QUERY_CACHE_BUSTER = 'expo-starter-query-cache-v2'

export const QUERY_CACHE_STORAGE_KEY =
  '@expo-starter:tanstack-query-cache'

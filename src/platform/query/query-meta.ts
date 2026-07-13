import '@tanstack/react-query'

export interface AppQueryMeta extends Record<string, unknown> {
  /** Explicitly opt a successful query into device persistence. */
  persist?: boolean
  /** Prevent persistence even when `persist` is accidentally enabled. */
  sensitive?: boolean
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: AppQueryMeta
  }
}

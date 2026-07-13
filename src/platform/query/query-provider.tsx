import { useEffect, type PropsWithChildren } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'

import { queryPersistOptions } from './persistence'
import { queryClient } from './query-client'
import { configureQueryRuntime } from './runtime'

export function QueryProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    configureQueryRuntime()
  }, [])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={queryPersistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  )
}

import {
  createContext,
  useContext,
  type PropsWithChildren,
} from 'react';

import type { AppSession } from './session';

const SessionContext = createContext<AppSession | null>(null);

interface SessionContextProviderProps extends PropsWithChildren {
  readonly value: AppSession;
}

export function SessionContextProvider({
  children,
  value,
}: SessionContextProviderProps) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): AppSession {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error(
      'useSession must be used within the application session provider.',
    );
  }

  return session;
}

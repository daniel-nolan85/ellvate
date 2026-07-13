import type { PropsWithChildren } from 'react';

import { ClerkSessionProvider } from '@/src/services/clerk';

export function AuthenticationProvider({ children }: PropsWithChildren) {
  return <ClerkSessionProvider>{children}</ClerkSessionProvider>;
}

import {
  ClerkProvider,
  useAuth,
} from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useMemo, type PropsWithChildren } from 'react';

import { getClerkConfiguration } from '@/src/platform/environment';
import {
  createMisconfiguredSession,
  createSignedInSession,
  disabledSession,
  loadingSession,
  SessionContextProvider,
  signedOutSession,
  type AppSession,
} from '@/src/platform/session';

function ClerkSessionBridge({ children }: PropsWithChildren) {
  const { getToken, isLoaded, isSignedIn, signOut, userId } = useAuth();

  const session = useMemo<AppSession>(() => {
    if (!isLoaded) {
      return loadingSession;
    }

    if (!isSignedIn) {
      return signedOutSession;
    }

    return createSignedInSession({
      getToken: () => getToken(),
      signOut: () => signOut(),
      userId,
    });
  }, [getToken, isLoaded, isSignedIn, signOut, userId]);

  return (
    <SessionContextProvider value={session}>{children}</SessionContextProvider>
  );
}

export function ClerkSessionProvider({ children }: PropsWithChildren) {
  const configuration = getClerkConfiguration();

  if (configuration.status === 'disabled') {
    return (
      <SessionContextProvider value={disabledSession}>
        {children}
      </SessionContextProvider>
    );
  }

  if (configuration.status === 'misconfigured') {
    return (
      <SessionContextProvider
        value={createMisconfiguredSession(configuration.message)}
      >
        {children}
      </SessionContextProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={configuration.publishableKey}
      tokenCache={tokenCache}
    >
      <ClerkSessionBridge>{children}</ClerkSessionBridge>
    </ClerkProvider>
  );
}

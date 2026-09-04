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
  // Native session sync goes through an async "pending" phase; Clerk's
  // default (treatPendingAsSignedOut: true) reports that phase as signed
  // out, which can bounce an already-authenticated user back to the
  // sign-in screen (observed as an unrecoverable lockout on the sign-in
  // screen after backgrounding/restarting the app).
  const { getToken, isLoaded, isSignedIn, signOut, userId } = useAuth({
    treatPendingAsSignedOut: false,
  });

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

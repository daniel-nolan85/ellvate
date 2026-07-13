import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { AuthView } from '@clerk/expo/native';

import { Spinner } from '@/src/components/ui/spinner';
import { useSession } from '@/src/platform/session';

// Gates the app behind a real Clerk sign-in when Clerk mode is active. AuthView
// is the native sign-in/up UI and adapts to the instance's enabled factors
// (phone + password + email + passkey); it syncs the session automatically. When
// auth is disabled/misconfigured the session status is not 'signed-out', so the
// app renders normally.
export function ClerkAuthGate({ children }: PropsWithChildren) {
  const session = useSession();

  if (session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner />
      </View>
    );
  }

  if (session.status === 'signed-out') {
    return (
      <View className="flex-1 bg-canvas">
        <AuthView mode="signInOrUp" />
      </View>
    );
  }

  return children;
}

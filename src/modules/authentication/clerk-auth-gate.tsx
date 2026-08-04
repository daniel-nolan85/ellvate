import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { Spinner } from '@/src/components/ui/spinner';
import { useSession } from '@/src/platform/session';

// Holds the app on a spinner only while the secure session cache is being
// restored. Sign-in and sign-up happen inside the onboarding flow (phone +
// password + code, then the Face ID offer), so this gate never renders its own
// auth screen — it just lets the app through once the session status is known.
export function ClerkAuthGate({ children }: PropsWithChildren) {
  const session = useSession();

  if (session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner size="xlarge" />
      </View>
    );
  }

  return children;
}

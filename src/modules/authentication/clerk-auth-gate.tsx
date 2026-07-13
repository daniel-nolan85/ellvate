import { useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';

import { Spinner } from '@/src/components/ui/spinner';
import { useSession } from '@/src/platform/session';

import { PasskeyOffer } from './sign-in/passkey-offer';
import { SignInScreen } from './sign-in/sign-in-screen';

// Gates the app behind a custom Clerk sign-in when Clerk mode is active: phone
// number + password, verified by an SMS code, and a one-time Face ID (passkey)
// offer right after a new account is created. When auth is disabled the session
// status is never 'signed-out', so the app renders normally.
export function ClerkAuthGate({ children }: PropsWithChildren) {
  const session = useSession();
  const [offerPasskey, setOfferPasskey] = useState(false);

  if (session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner />
      </View>
    );
  }

  if (session.status === 'signed-out') {
    return <SignInScreen onSignedUp={() => setOfferPasskey(true)} />;
  }

  if (session.status === 'signed-in' && offerPasskey) {
    return <PasskeyOffer onDone={() => setOfferPasskey(false)} />;
  }

  return children;
}

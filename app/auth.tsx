import { useRouter } from 'expo-router';

import {
  AuthenticationStateScreen,
  SignInScreen,
} from '@/src/modules/authentication';
import { useSession } from '@/src/platform/session';

// Standalone sign-in entry point for a returning, signed-out user (reached
// from the profile screen's Sign out action) -- distinct from AuthStep,
// which renders the same SignInScreen inline as one slot of the onboarding
// wizard for brand-new users.
export default function AuthenticationRoute() {
  const session = useSession();
  const router = useRouter();

  if (session.status === 'misconfigured' || session.status === 'disabled') {
    return <AuthenticationStateScreen />;
  }

  return (
    <SignInScreen
      onAuthenticated={() => router.replace('/')}
      onExit={() => router.replace('/')}
    />
  );
}

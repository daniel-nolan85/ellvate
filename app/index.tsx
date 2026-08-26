import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { canAccessCommunityRoutes } from '@/src/modules/authentication';
import { Spinner } from '@/src/components/ui/spinner';
import { useOnboardingComplete } from '@/src/modules/onboarding';
import { useSession } from '@/src/platform/session';

export default function IndexRoute() {
  const isComplete = useOnboardingComplete();
  const session = useSession();

  // session.status starts 'loading' on every fresh boot (Clerk hasn't
  // restored the session yet -- on web that's every page reload, not just a
  // cold app launch). Deciding before it settles falls through to the
  // /onboarding redirect below, which then finds an already-signed-in,
  // already-onboarded user and re-shows the welcome-back greeting on every
  // reload instead of going straight to the forum.
  if (isComplete === undefined || session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner size="xlarge" />
      </View>
    );
  }

  if (isComplete && canAccessCommunityRoutes(session.status)) {
    return <Redirect href="/(tabs)/forum" />;
  }

  // A device that already finished onboarding but isn't currently signed in
  // (mid sign-out, or the app reopened after one) goes to sign-in, not back
  // through the wizard -- same reasoning as the profile screen's own Sign
  // out action. This also covers landing here indirectly (e.g. the layout's
  // Stack.Protected guard bouncing to this route when session.status stops
  // being signed-in, which can outrace an explicit navigation elsewhere).
  if (isComplete && session.status === 'signed-out') {
    return <Redirect href="/auth" />;
  }

  return <Redirect href="/onboarding" />;
}

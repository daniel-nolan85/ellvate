import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { canAccessCommunityRoutes } from '@/src/modules/authentication';
import { Spinner } from '@/src/components/ui/spinner';
import { useOnboardingComplete } from '@/src/modules/onboarding';
import { useProfile } from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';

export default function IndexRoute() {
  const localComplete = useOnboardingComplete();
  const session = useSession();
  const isRealSignedIn = session.status === 'signed-in';

  // A real Clerk account's own onboardedAt -- not the device-wide local flag
  // -- decides completion once a real session exists. The local flag has no
  // idea which account last finished onboarding: a device that previously
  // onboarded one person still has it set to true, so without this, signing
  // out and a second, brand-new account signing in on the same device (or an
  // existing account that predates onboarding) would land straight in the
  // app with the wizard skipped entirely and no role/interests/notification
  // prefs ever set. Only fetched once a real session is confirmed -- signed-
  // out/loading/disabled states have no account to ask.
  const profile = useProfile({ enabled: isRealSignedIn });

  // session.status starts 'loading' on every fresh boot (Clerk hasn't
  // restored the session yet -- on web that's every page reload, not just a
  // cold app launch). Deciding before it settles falls through to the
  // /onboarding redirect below, which then finds an already-signed-in,
  // already-onboarded user and re-shows the welcome-back greeting on every
  // reload instead of going straight to the forum.
  if (
    localComplete === undefined ||
    session.status === 'loading' ||
    (isRealSignedIn && profile.isPending)
  ) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner size="xlarge" />
      </View>
    );
  }

  // Boolean(...), not `!== null` -- profile.data is undefined while pending
  // and stays undefined on a fetch error too, and `undefined !== null` is
  // true, which would wrongly treat a failed/incomplete fetch as onboarded
  // and let the account straight into the app. Defaulting to false here
  // means a transient error shows the wizard rather than silently granting
  // access.
  const isComplete = isRealSignedIn
    ? Boolean(profile.data?.profile.onboardedAt)
    : localComplete;

  if (isComplete && canAccessCommunityRoutes(session.status)) {
    return <Redirect href="/(tabs)/forum" />;
  }

  // A device that already finished onboarding but isn't currently signed in
  // (mid sign-out, or the app reopened after one) goes to sign-in, not back
  // through the wizard -- same reasoning as the profile screen's own Sign
  // out action. This also covers landing here indirectly (e.g. the layout's
  // Stack.Protected guard bouncing to this route when session.status stops
  // being signed-in, which can outrace an explicit navigation elsewhere).
  // No real account is signed in here, so this is always the local flag.
  if (localComplete && session.status === 'signed-out') {
    return <Redirect href="/auth" />;
  }

  return <Redirect href="/onboarding" />;
}

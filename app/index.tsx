import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { canAccessCommunityRoutes } from '@/src/modules/authentication';
import { Spinner } from '@/src/components/ui/spinner';
import { useOnboardingComplete } from '@/src/modules/onboarding';
import { useSession } from '@/src/platform/session';

export default function IndexRoute() {
  const isComplete = useOnboardingComplete();
  const session = useSession();

  if (isComplete === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner size="xlarge" />
      </View>
    );
  }

  const canEnterCommunity =
    isComplete && canAccessCommunityRoutes(session.status);

  return <Redirect href={canEnterCommunity ? '/(tabs)/forum' : '/onboarding'} />;
}

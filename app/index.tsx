import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Spinner } from '@/src/components/ui/spinner';
import { useOnboardingComplete } from '@/src/modules/onboarding';

export default function IndexRoute() {
  const isComplete = useOnboardingComplete();

  if (isComplete === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner />
      </View>
    );
  }

  return <Redirect href={isComplete ? '/(tabs)/forum' : '/onboarding'} />;
}

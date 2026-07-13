import { router } from 'expo-router';

import { OnboardingFlow } from '@/src/modules/onboarding';

export default function OnboardingRoute() {
  return <OnboardingFlow onFinished={() => router.replace('/(tabs)/forum')} />;
}

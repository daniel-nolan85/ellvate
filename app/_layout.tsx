import '@/global.css';
import 'react-native-reanimated';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  canAccessCommunityRoutes,
  ClerkAuthGate,
} from '@/src/modules/authentication';
import { AppProviders } from '@/src/platform/providers';
import { PushRegistration } from '@/src/platform/push';
import { useSession } from '@/src/platform/session';

export const unstable_settings = {
  initialRouteName: 'index',
};

function AppNavigator() {
  const session = useSession();
  const canAccessCommunity = canAccessCommunityRoutes(session.status);

  return (
    <ClerkAuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />

        <Stack.Protected guard={canAccessCommunity}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="protected" />
          <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </ClerkAuthGate>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <AppNavigator />
        <PushRegistration />
        <StatusBar style="auto" />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

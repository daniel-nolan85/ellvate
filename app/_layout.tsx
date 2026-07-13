import '@/global.css';
import 'react-native-reanimated';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ClerkAuthGate } from '@/src/modules/authentication';
import { AppProviders } from '@/src/platform/providers';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <ClerkAuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="post/[id]" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="protected" />
            <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
          </Stack>
        </ClerkAuthGate>
        <StatusBar style="auto" />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

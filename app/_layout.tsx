import '@/global.css';
import 'react-native-reanimated';

import { Component, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  canAccessCommunityRoutes,
  ClerkAuthGate,
} from '@/src/modules/authentication';
import { AppProviders } from '@/src/platform/providers';
import { PushRegistration } from '@/src/platform/push';
import { useSession } from '@/src/platform/session';
import { initCrashReporting, reportError } from '@/src/services/crash-reporting';

initCrashReporting();

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
          <Stack.Screen
            name="notifications"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="activity" options={{ presentation: 'modal' }} />
          <Stack.Screen name="bookmarks" options={{ presentation: 'modal' }} />
          <Stack.Screen name="digest" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </ClerkAuthGate>
  );
}

// Plain React error boundary, deliberately not Sentry's -- Sentry.wrap() and
// Sentry's own ErrorBoundary pull in TouchEventBoundary/Profiler/
// FeedbackFormProvider, which touch native-adjacent RN internals unconditionally,
// even when crash reporting is disabled (no DSN). Reporting a caught error to
// Sentry still happens via reportError(), which already no-ops without a DSN --
// but catching the error and showing a fallback must never itself depend on
// Sentry being fully wired up correctly.
class AppErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly error: unknown }
> {
  state: { readonly error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    reportError(error);
  }

  render() {
    if (this.state.error) {
      return <CrashFallback resetError={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function CrashFallback({ resetError }: { readonly resetError: () => void }) {
  return (
    <VStack className="flex-1 items-center justify-center bg-canvas px-10" space="sm">
      <Text className="text-center font-inter-semibold text-content" size="lg">
        Something went wrong
      </Text>
      <Text className="text-center text-text-muted" size="sm">
        The app hit an unexpected error. Give it another try.
      </Text>
      <Button className="mt-2 rounded-full bg-accent px-6" onPress={resetError} size="sm">
        <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
          Try again
        </ButtonText>
      </Button>
    </VStack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ backgroundColor: 'rgb(247,241,230)', flex: 1 }}>
      <AppErrorBoundary>
        <AppProviders>
          <AppNavigator />
          <PushRegistration />
          <StatusBar style="auto" />
        </AppProviders>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

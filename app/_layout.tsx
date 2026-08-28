import '@/global.css';
import 'react-native-reanimated';

import { Component, useState, type ReactNode } from 'react';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ButtonText } from '@/src/components/ui/button';
import { ConfirmModal } from '@/src/components/ui/confirm-modal';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  canAccessCommunityRoutes,
  ClerkAuthGate,
} from '@/src/modules/authentication';
import { AssistantButton } from '@/src/modules/community-shell';
import { useWelcomeBackNotice } from '@/src/platform/notices';
import { AppProviders } from '@/src/platform/providers';
import { PushRegistration } from '@/src/platform/push';
import { useSession } from '@/src/platform/session';
import { AnimatedSplash } from '@/src/platform/splash';
import { initCrashReporting, reportError } from '@/src/services/crash-reporting';

initCrashReporting();

export const unstable_settings = {
  initialRouteName: 'index',
};

// Screens reachable without community access -- everything else lives under
// Stack.Protected below. canAccessCommunity alone isn't enough to gate the
// floating assistant button: in disabled/demo auth mode it's true from the
// very first render (see canAccessCommunityRoutes), which would otherwise
// show the button floating over the pre-auth marketing/onboarding screens
// too, something it never did while it only lived inside the tab bar.
const UNPROTECTED_ROUTES = new Set(['index', 'onboarding', 'auth']);

function AppNavigator() {
  const session = useSession();
  const welcomeBack = useWelcomeBackNotice();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const canAccessCommunity = canAccessCommunityRoutes(session.status);
  const onProtectedRoute = segments.length > 0 && !UNPROTECTED_ROUTES.has(segments[0]);

  return (
    <ClerkAuthGate>
      {/* contentStyle guards against the native stack's own default white
          screen background -- otherwise visible as a white flash/edge during
          push/pop transitions and behind any screen that hasn't yet painted
          its own bg-canvas content, on every route in the app. */}
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: 'rgb(247,241,230)' },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />

        <Stack.Protected guard={canAccessCommunity}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="petition/[id]" />
          <Stack.Screen name="protected" />
          <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="notifications"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="activity" options={{ presentation: 'modal' }} />
          <Stack.Screen name="bookmarks" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="blocked-users"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="digest" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      {canAccessCommunity && onProtectedRoute ? (
        // Floats persistently above the tab bar (which sits at
        // max(20, insets.bottom + 8), 68px tall -- see FloatingTabBar) on
        // every protected screen, tabs and non-tab alike, so it no longer
        // needs to be threaded through CommunityNavBar per-screen.
        <AssistantButton
          onPress={() => router.push('/assistant')}
          style={{
            bottom: Math.max(20, insets.bottom + 8) + 68 + 16,
            position: 'absolute',
            right: 16,
            zIndex: 10,
          }}
        />
      ) : null}
      <ConfirmModal
        cancelLabel="Continue"
        message="Good to see you again."
        onClose={welcomeBack.dismiss}
        title={welcomeBack.name ? `Welcome back, ${welcomeBack.name}!` : 'Welcome back!'}
        visible={welcomeBack.name !== null}
      />
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
  const [bootSplashDone, setBootSplashDone] = useState(false);

  return (
    <GestureHandlerRootView style={{ backgroundColor: 'rgb(247,241,230)', flex: 1 }}>
      <AppErrorBoundary>
        <AppProviders>
          {bootSplashDone ? (
            <>
              <AppNavigator />
              <PushRegistration />
            </>
          ) : (
            // AppProviders already held rendering until fonts (DuneRise
            // included) resolved, so this has nothing left to wait on itself.
            <AnimatedSplash onFinish={() => setBootSplashDone(true)} />
          )}
          <StatusBar style="auto" />
        </AppProviders>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

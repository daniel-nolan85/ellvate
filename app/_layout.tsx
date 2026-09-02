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
          {/* A native `presentation: 'modal'` screen isn't flush with the
              real screen origin (iOS presents it as an inset page sheet),
              which breaks KeyboardAvoidingView's offset math -- so this stays
              a normal pushed screen with a slide-up transition instead of a
              true modal presentation, to keep the chat input reachable. */}
          <Stack.Screen
            name="assistant"
            options={{ animation: 'slide_from_bottom' }}
          />
          {/* Profile/Leaderboard/Activity/Bookmarks/Blocked-users are full
              screens (their own ScreenTitle header + the floating
              CommunityNavBar) reached from a persistent icon or a tap inside
              another full screen -- peer sections, not a modal and not a
              drill-in from a list. `presentation: 'modal'` stacked
              modal-on-modal when reached from Profile and made their normal
              header read as "inside a modal"; the platform's default push
              animation (a right-to-left slide) instead made switching to one
              feel like navigating deeper rather than switching sections, the
              way tapping a different tab never does. `animation: 'none'`
              matches that "just switch" feel while staying a plain pushed
              screen. */}
          <Stack.Screen name="profile" options={{ animation: 'none' }} />
          <Stack.Screen name="leaderboard" options={{ animation: 'none' }} />
          <Stack.Screen
            name="notifications"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="activity" options={{ animation: 'none' }} />
          <Stack.Screen name="bookmarks" options={{ animation: 'none' }} />
          <Stack.Screen name="blocked-users" options={{ animation: 'none' }} />
          <Stack.Screen name="digest" options={{ presentation: 'modal' }} />
          {/* A summoned utility overlay (like `assistant`), not a drill-in
              from a list -- slides up rather than the default right-to-left
              push, and stays a plain pushed screen (not `presentation:
              'modal'`) so it renders full-bleed like the detail screens
              instead of iOS's inset page-sheet look. */}
          <Stack.Screen
            name="search"
            options={{ animation: 'slide_from_bottom' }}
          />
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

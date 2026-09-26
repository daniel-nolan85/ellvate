import '@/global.css';
import 'react-native-reanimated';

import { Component, useState, type ReactNode } from 'react';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
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
import { AssistantButton, MODAL_SCREEN_OPTIONS, SHEET_SCREEN_OPTIONS } from '@/src/modules/community-shell';
import { XpFeedbackProvider } from '@/src/modules/xp';
import { useWelcomeBackNotice } from '@/src/platform/notices';
import { AppProviders } from '@/src/platform/providers';
import { PushRegistration } from '@/src/platform/push';
import { useSession } from '@/src/platform/session';
import { AnimatedSplash } from '@/src/platform/splash';
import { initCrashReporting, reportError } from '@/src/services/crash-reporting';

initCrashReporting();

// Held until AppProviders is done waiting on fonts and about to render
// AnimatedSplash -- which shares this same dark BOOT_BACKGROUND and the
// custom fonts it needs to draw its own wordmark, so without this the
// native splash can (and on Android reliably does, per its stricter
// SplashScreen-autohide timing) auto-hide the moment this RN tree first
// mounts, which happens before fonts resolve. That exposes this
// GestureHandlerRootView's own sandy background underneath for a beat --
// a color-mismatched flash between the dark native splash and the dark
// AnimatedSplash that's about to replace it. See AppProviders' hideAsync
// call for the other half of this.
void SplashScreen.preventAutoHideAsync();

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

// Content detail screens that dock their own composer (a comment or review
// field + send button) at the very bottom -- the assistant button's fixed
// offset below is calibrated for the floating tab bar's height, which these
// screens don't render, so without this exclusion it floats on top of
// whatever's actually sitting there instead.
const COMPOSER_DOCKED_ROUTES = new Set(['mission', 'post', 'event', 'petition', 'service']);

function AppNavigator() {
  const session = useSession();
  const welcomeBack = useWelcomeBackNotice();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const canAccessCommunity = canAccessCommunityRoutes(session.status);
  const onProtectedRoute = segments.length > 0 && !UNPROTECTED_ROUTES.has(segments[0]);
  const hasDockedComposer = segments.length > 0 && COMPOSER_DOCKED_ROUTES.has(segments[0]);

  return (
    <ClerkAuthGate>
      {/* Mounted above the navigation stack (not inside any one screen) so
          the XP toast/level-up/rank-up celebrations it renders survive
          navigating between screens -- see XpFeedbackProvider's own WHY. */}
      <XpFeedbackProvider>
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
            {/* Same drill-in treatment as post/[id/petition/[id] above --
                these were previously left undeclared, which meant Expo Router
                auto-registered them outside this guard entirely (not gated by
                canAccessCommunity at all), the same gap `leaderboard` had. */}
            <Stack.Screen name="mission/[id]" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="service/[id]" />
            <Stack.Screen name="business/[id]" />
            {/* formSheet duplicates of the 5 screens above, used only by
                Notifications -- see app/notification/post/[id].tsx. formSheet
                (not MODAL_SCREEN_OPTIONS) for the native grabber; safe here
                since Notifications is a plain screen, not another formSheet
                (the #3569 chaining bug MODAL_SCREEN_OPTIONS exists for). */}
            <Stack.Screen name="notification/post/[id]" options={SHEET_SCREEN_OPTIONS} />
            <Stack.Screen name="notification/event/[id]" options={SHEET_SCREEN_OPTIONS} />
            <Stack.Screen name="notification/mission/[id]" options={SHEET_SCREEN_OPTIONS} />
            <Stack.Screen name="notification/petition/[id]" options={SHEET_SCREEN_OPTIONS} />
            <Stack.Screen name="notification/business/[id]" options={SHEET_SCREEN_OPTIONS} />
            <Stack.Screen name="protected" />
            {/* A native `presentation: 'modal'` screen isn't flush with the
                real screen origin (iOS presents it as an inset page sheet),
                which breaks KeyboardAvoidingView's offset math -- so this stays
                a normal pushed screen with a slide-up transition instead of a
                true modal presentation, to keep the chat input reachable. */}
            <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
            {/* Profile/Leaderboard/Activity/Bookmarks/Blocked-users/Points
                history are full screens (their own ScreenTitle header + the
                floating CommunityNavBar) reached from a persistent icon or a
                tap inside another full screen -- peer sections, not a modal
                and not a drill-in from a list. `presentation: 'modal'` stacked
                modal-on-modal when reached from Profile and made their normal
                header read as "inside a modal"; the platform's default push
                animation (a right-to-left slide) instead made switching to one
                feel like navigating deeper rather than switching sections, the
                way tapping a different tab never does. `animation: 'none'`
                matches that "just switch" feel while staying a plain pushed
                screen. Points history has only one entry point (Profile's
                XpHero card) rather than a persistent icon, but its header has
                no back chevron either -- the ScreenTitle avatar button routes
                back to Profile the same way it does everywhere else -- so it
                gets the same peer-section treatment as the rest. */}
            <Stack.Screen name="profile" options={{ animation: 'none' }} />
            <Stack.Screen name="points-history" options={{ animation: 'none' }} />
            <Stack.Screen name="leaderboard" options={{ animation: 'none' }} />
            <Stack.Screen name="activity" options={{ animation: 'none' }} />
            <Stack.Screen name="bookmarks" options={{ animation: 'none' }} />
            <Stack.Screen name="blocked-users" options={{ animation: 'none' }} />
            {/* Plain pushed screen, not modal/formSheet -- see notifications-screen.tsx. */}
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_bottom' }} />
            {/* Every dismissible overlay shares SHEET_SCREEN_OPTIONS except
                member/[userId]/activity -- see MODAL_SCREEN_OPTIONS. Digest's
                two entry points (Notifications, a Profile icon tap) are both
                plain screens, so formSheet is safe here too. */}
            <Stack.Screen name="digest" options={SHEET_SCREEN_OPTIONS} />
            <Stack.Screen name="member/[userId]" options={SHEET_SCREEN_OPTIONS} />
            <Stack.Screen name="member/[userId]/activity" options={MODAL_SCREEN_OPTIONS} />
            {/* A summoned utility overlay (like `assistant`), not a drill-in
                from a list -- slides up rather than the default right-to-left
                push, and stays a plain pushed screen (not `presentation:
                'modal'`) so it renders full-bleed like the detail screens
                instead of iOS's inset page-sheet look. */}
            <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
          </Stack.Protected>
        </Stack>
        {canAccessCommunity && onProtectedRoute && !hasDockedComposer ? (
          // Floats persistently above the tab bar (which sits at
          // max(20, insets.bottom + 8), 68px tall -- see FloatingTabBar) on
          // every protected screen, tabs and non-tab alike, so it no longer
          // needs to be threaded through CommunityNavBar per-screen. Excluded
          // on COMPOSER_DOCKED_ROUTES -- see that const's own WHY.
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
      </XpFeedbackProvider>
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

import { useEffect, useRef, type PropsWithChildren } from 'react';

import * as SplashScreen from 'expo-splash-screen';

import { GluestackUIProvider } from '@/src/components/ui/gluestack-ui-provider';
import { AuthenticationProvider } from '@/src/modules/authentication';
import { useAppFonts } from '@/src/platform/fonts';
import { WelcomeBackNoticeProvider } from '@/src/platform/notices';
import { clearQueryCache, QueryProvider } from '@/src/platform/query';
import { useSession } from '@/src/platform/session';
import { useExpoUpdatesBootstrap } from '@/src/platform/updates';

function SessionQueryBoundary({ children }: PropsWithChildren) {
  const session = useSession();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const currentUserId = session.status === 'signed-in' ? session.userId : null;

    if (
      previousUserId.current !== undefined
      && previousUserId.current !== currentUserId
    ) {
      void clearQueryCache();
    }

    previousUserId.current = currentUserId;
  }, [session.status, session.userId]);

  return children;
}

export function AppProviders({ children }: PropsWithChildren) {
  useExpoUpdatesBootstrap();
  const fonts = useAppFonts();
  const ready = fonts.loaded || fonts.error;

  // Releases the native splash (held by preventAutoHideAsync() in
  // app/_layout.tsx) at the exact moment this is about to render real
  // children for the first time -- AnimatedSplash, next in line, shares the
  // native splash's dark background and needs these same fonts to draw its
  // own wordmark, so hiding any earlier would expose a mismatched sandy
  // background for however long fonts take to resolve.
  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  // Hold startup until fonts resolve, but never block forever: on a font-load
  // failure, render with the system fallback rather than a permanent blank screen.
  if (!ready) {
    return null;
  }

  return (
    <GluestackUIProvider mode="light">
      <AuthenticationProvider>
        <QueryProvider>
          <SessionQueryBoundary>
            <WelcomeBackNoticeProvider>{children}</WelcomeBackNoticeProvider>
          </SessionQueryBoundary>
        </QueryProvider>
      </AuthenticationProvider>
    </GluestackUIProvider>
  );
}

import { useEffect, useRef, type PropsWithChildren } from 'react';

import { GluestackUIProvider } from '@/src/components/ui/gluestack-ui-provider';
import { AuthenticationProvider } from '@/src/modules/authentication';
import { useAppFonts } from '@/src/platform/fonts';
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

  // Hold startup until fonts resolve, but never block forever: on a font-load
  // failure, render with the system fallback rather than a permanent blank screen.
  if (!fonts.loaded && !fonts.error) {
    return null;
  }

  return (
    <GluestackUIProvider mode="light">
      <AuthenticationProvider>
        <QueryProvider>
          <SessionQueryBoundary>{children}</SessionQueryBoundary>
        </QueryProvider>
      </AuthenticationProvider>
    </GluestackUIProvider>
  );
}

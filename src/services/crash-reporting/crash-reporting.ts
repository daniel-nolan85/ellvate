import * as Sentry from '@sentry/react-native';

import { publicEnvironment } from '@/src/platform/environment';

let initialized = false;

// No-ops when EXPO_PUBLIC_SENTRY_DSN isn't set, which keeps local/demo
// development silent by default -- set the DSN (and eventually deploy with
// it configured) to start receiving crash and error reports. Called once at
// app entry (app/_layout.tsx), before any error boundary exists to catch a
// throw here, so a bad DSN or unavailable native module must not crash the app.
export function initCrashReporting(): void {
  if (initialized || !publicEnvironment.sentryDsn) {
    return;
  }
  initialized = true;
  try {
    Sentry.init({
      dsn: publicEnvironment.sentryDsn,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: 0,
    });
  } catch {
    // Crash reporting itself must never be the thing that crashes the app.
  }
}

// Called from error-handling paths (e.g. an error boundary's componentDidCatch)
// where a secondary throw would defeat the point -- swallow any failure here
// rather than let a reporting problem block showing the user a fallback.
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!publicEnvironment.sentryDsn) {
    return;
  }
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reporting is best-effort only.
  }
}

import Constants from 'expo-constants';

import { deriveDefaultApiUrl } from './dev-api-url';

export type AuthMode = 'clerk' | 'disabled';

export type ClerkConfiguration =
  | { readonly status: 'disabled' }
  | { readonly message: string; readonly status: 'misconfigured' }
  | { readonly publishableKey: string; readonly status: 'ready' };

export interface PublicEnvironment {
  readonly apiUrl: string | null;
  readonly authMode: AuthMode;
  readonly clerkPublishableKey: string | null;
  readonly marketingUrl: string | null;
  readonly sentryDsn: string | null;
  readonly issues: readonly string[];
}

const normalizeUrl = (value: string | null | undefined): string | null => {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
};

const rawAuthMode =
  process.env.EXPO_PUBLIC_MAESTRO_AUTH_MODE?.trim() ||
  process.env.EXPO_PUBLIC_AUTH_MODE?.trim();
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const rawClerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
const rawMarketingUrl = process.env.EXPO_PUBLIC_MARKETING_URL?.trim();
const rawSentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

const issues: string[] = [];

if (rawAuthMode && rawAuthMode !== 'clerk' && rawAuthMode !== 'disabled') {
  issues.push('EXPO_PUBLIC_AUTH_MODE must be either "disabled" or "clerk".');
}

const explicitApiUrl = normalizeUrl(rawApiUrl);
if (rawApiUrl && !explicitApiUrl) {
  issues.push('EXPO_PUBLIC_API_URL must be an absolute URL.');
}

const marketingUrl = normalizeUrl(rawMarketingUrl);
if (rawMarketingUrl && !marketingUrl) {
  issues.push('EXPO_PUBLIC_MARKETING_URL must be an absolute URL.');
}

// Without an explicit API URL: web uses its same-origin API routes (dev and
// production); native dev builds target the running Expo dev server. A
// production native build stays null until EXPO_PUBLIC_API_URL is set.
const webOrigin =
  typeof window !== 'undefined' ? (window.location?.origin ?? null) : null;
const apiUrl =
  explicitApiUrl
  ?? (rawApiUrl
    ? null
    : normalizeUrl(
      deriveDefaultApiUrl(Constants.expoConfig?.hostUri, __DEV__, webOrigin),
    ));

const authMode: AuthMode = rawAuthMode === 'clerk' ? 'clerk' : 'disabled';
const clerkPublishableKey = rawClerkPublishableKey || null;
const sentryDsn = rawSentryDsn || null;

if (
  authMode === 'clerk'
  && (!clerkPublishableKey || !/^pk_(test|live)_/.test(clerkPublishableKey))
) {
  issues.push(
    'Clerk mode requires EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY with a pk_test_ or pk_live_ prefix.',
  );
}

export const publicEnvironment: PublicEnvironment = Object.freeze({
  apiUrl,
  authMode,
  clerkPublishableKey,
  marketingUrl,
  sentryDsn,
  issues: Object.freeze(issues),
});

export const getClerkConfiguration = (): ClerkConfiguration => {
  if (publicEnvironment.authMode === 'disabled') {
    return { status: 'disabled' };
  }

  if (!publicEnvironment.clerkPublishableKey) {
    return {
      message: 'Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before enabling Clerk mode.',
      status: 'misconfigured',
    };
  }

  if (!/^pk_(test|live)_/.test(publicEnvironment.clerkPublishableKey)) {
    return {
      message: 'The Clerk publishable key must begin with pk_test_ or pk_live_.',
      status: 'misconfigured',
    };
  }

  return {
    publishableKey: publicEnvironment.clerkPublishableKey,
    status: 'ready',
  };
};

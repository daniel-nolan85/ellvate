import type { ConfigContext, ExpoConfig } from 'expo/config';

type ConfigPlugins = NonNullable<ExpoConfig['plugins']>;

const environmentValue = (name: string): string | undefined =>
  process.env[name]?.trim() || undefined;

const isHttpsUrl = (value: string | undefined): boolean => {
  try {
    return value ? new URL(value).protocol === 'https:' : false;
  } catch {
    return false;
  }
};

const validateProductionClientConfig = (): readonly string[] => {
  const issues: string[] = [];
  if (environmentValue('EXPO_PUBLIC_MAESTRO_AUTH_MODE')) {
    issues.push('EXPO_PUBLIC_MAESTRO_AUTH_MODE cannot be set in production.');
  }
  if (environmentValue('EXPO_PUBLIC_MAESTRO_PROFILE_SYNC_FAIL_ONCE')) {
    issues.push(
      'EXPO_PUBLIC_MAESTRO_PROFILE_SYNC_FAIL_ONCE cannot be set in production.',
    );
  }
  if (process.env.EXPO_PUBLIC_AUTH_MODE !== 'clerk') {
    issues.push('EXPO_PUBLIC_AUTH_MODE must be "clerk" in production.');
  }
  if (!/^pk_live_/.test(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '')) {
    issues.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a live Clerk key.');
  }
  if (!isHttpsUrl(process.env.EXPO_PUBLIC_API_URL)) {
    issues.push('EXPO_PUBLIC_API_URL must be an HTTPS production API URL.');
  }
  if (!environmentValue('EAS_PROJECT_ID')) {
    issues.push('EAS_PROJECT_ID is required in production.');
  }
  if (!environmentValue('IOS_BUNDLE_IDENTIFIER')) {
    issues.push('IOS_BUNDLE_IDENTIFIER is required in production.');
  }
  if (!environmentValue('ANDROID_PACKAGE')) {
    issues.push('ANDROID_PACKAGE is required in production.');
  }
  return issues;
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = environmentValue('EAS_PROJECT_ID');
  const iosBundleIdentifier = environmentValue('IOS_BUNDLE_IDENTIFIER');
  const androidPackage = environmentValue('ANDROID_PACKAGE');

  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const issues = validateProductionClientConfig();
    if (issues.length > 0) {
      throw new Error(`Production client configuration is invalid:\n- ${issues.join('\n- ')}`);
    }
  }

  return {
    ...config,
    name: environmentValue('APP_NAME') ?? config.name ?? 'Expo Starter',
    slug: environmentValue('APP_SLUG') ?? config.slug ?? 'expo-starter',
    scheme: environmentValue('APP_SCHEME') ?? config.scheme ?? 'expo-starter',
    ios: {
      ...config.ios,
      ...(iosBundleIdentifier ? { bundleIdentifier: iosBundleIdentifier } : {}),
    },
    android: {
      ...config.android,
      ...(androidPackage ? { package: androidPackage } : {}),
    },
    plugins: config.plugins as ConfigPlugins | undefined,
    updates: {
      ...config.updates,
      enabled: Boolean(easProjectId),
      ...(easProjectId ? { url: `https://u.expo.dev/${easProjectId}` } : {}),
    },
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};

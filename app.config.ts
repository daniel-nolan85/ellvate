import type { ConfigContext, ExpoConfig } from 'expo/config';

type ConfigPlugins = NonNullable<ExpoConfig['plugins']>;

const environmentValue = (name: string): string | undefined =>
  process.env[name]?.trim() || undefined;

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = environmentValue('EAS_PROJECT_ID');
  const iosBundleIdentifier = environmentValue('IOS_BUNDLE_IDENTIFIER');
  const androidPackage = environmentValue('ANDROID_PACKAGE');

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

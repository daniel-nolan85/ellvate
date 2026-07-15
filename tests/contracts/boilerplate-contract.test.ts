import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');

const readJson = <T>(path: string): T => JSON.parse(
  readFileSync(resolve(root, path), 'utf8'),
) as T;

describe('Expo starter contract', () => {
  test('pins the reusable Expo, Clerk, and TanStack baseline', () => {
    const packageJson = readJson<{
      dependencies: Record<string, string>;
      name?: string;
      packageManager?: string;
    }>('package.json');

    expect(packageJson.name?.trim().length ?? 0).toBeGreaterThan(0);
    expect(packageJson.packageManager).toBe('bun@1.3.13');
    expect(packageJson.dependencies.expo).toBe('~54.0.35');
    expect(packageJson.dependencies['expo-router']).toBe('~6.0.24');
    expect(packageJson.dependencies['expo-updates']).toBe('~29.0.18');
    expect(packageJson.dependencies['@clerk/expo']).toBe('3.2.15');
    expect(packageJson.dependencies['@tanstack/react-query']).toBe('5.101.0');
    expect(packageJson.dependencies.nativewind).toMatch(/^\^4\./);
    expect(packageJson.dependencies.nativewind).not.toContain('preview');
  });

  test('provides valid defaults and per-copy identity seams', () => {
    const appConfig = readJson<{
      expo: {
        android: { package?: string };
        ios: { bundleIdentifier?: string };
        name: string;
        scheme: string;
        slug: string;
      };
    }>('app.json');
    const dynamicConfig = readFileSync(resolve(root, 'app.config.ts'), 'utf8');
    const environmentExample = readFileSync(resolve(root, '.env.example'), 'utf8');

    expect(appConfig.expo.name.trim().length).toBeGreaterThan(0);
    expect(appConfig.expo.slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(appConfig.expo.scheme).toMatch(/^[a-z][a-z0-9+.-]*$/);

    for (const variable of [
      'APP_NAME',
      'APP_SLUG',
      'APP_SCHEME',
      'IOS_BUNDLE_IDENTIFIER',
      'ANDROID_PACKAGE',
    ]) {
      expect(dynamicConfig).toContain(`environmentValue('${variable}')`);
      expect(environmentExample).toContain(`${variable}=`);
    }
  });

  test('keeps OTA compatibility tied to app version and release channels', () => {
    const appConfig = readJson<{
      expo: {
        plugins: Array<string | [string, unknown]>;
        runtimeVersion?: { policy?: string };
      };
    }>('app.json');
    const easConfig = readJson<{
      build: Record<string, { channel?: string; environment?: string }>;
    }>('eas.json');

    expect(appConfig.expo.runtimeVersion?.policy).toBe('appVersion');
    expect(appConfig.expo.plugins.some((plugin) => (
      Array.isArray(plugin) ? plugin[0] === '@clerk/expo' : plugin === '@clerk/expo'
    ))).toBe(true);
    expect(easConfig.build.preview).toMatchObject({
      channel: 'preview',
      environment: 'preview',
    });
    expect(easConfig.build.production).toMatchObject({
      channel: 'production',
      environment: 'production',
    });
  });

  test('keeps persisted server-state compatibility separate from EAS runtime', () => {
    const queryConstants = readFileSync(
      resolve(root, 'src/platform/query/constants/cache.ts'),
      'utf8',
    );

    expect(queryConstants).toContain("QUERY_CACHE_BUSTER = 'expo-starter-query-cache-v2'");
    expect(queryConstants).not.toContain('Updates.updateId');
  });
});

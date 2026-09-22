import { afterEach, describe, expect, test } from 'bun:test';

import {
  assertServerRuntimeEnvironmentConfigured,
  ServerEnvironmentError,
  validateProductionEnvironment,
  validateServerRuntimeEnvironment,
} from '../../src/platform/environment/server-environment';

const valid = {
  ANDROID_PACKAGE: 'com.ellvate.app',
  BACKEND_AUTH_MODE: 'clerk',
  CLERK_SECRET_KEY: 'sk_live_example',
  EAS_PROJECT_ID: 'project-id',
  EXPO_PUBLIC_API_URL: 'https://api.example.com',
  EXPO_PUBLIC_AUTH_MODE: 'clerk',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example',
  IOS_BUNDLE_IDENTIFIER: 'com.ellvate.app',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_URL: 'https://supabase.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
};

describe('production environment validation', () => {
  test('accepts a complete Clerk, Supabase, and shared-limiter configuration', () => {
    expect(validateProductionEnvironment(valid)).toEqual([]);
  });

  test('rejects demo auth, missing data, insecure URLs, and missing limiter config', () => {
    const issues = validateProductionEnvironment({
      ...valid,
      BACKEND_AUTH_MODE: 'demo',
      EXPO_PUBLIC_API_URL: 'http://localhost:8081',
      EXPO_PUBLIC_AUTH_MODE: 'disabled',
      SUPABASE_PUBLISHABLE_KEY: '',
      SUPABASE_URL: 'http://localhost:54321',
      UPSTASH_REDIS_REST_TOKEN: '',
      UPSTASH_REDIS_REST_URL: '',
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        'EXPO_PUBLIC_AUTH_MODE must be "clerk" in production.',
        'BACKEND_AUTH_MODE must be "clerk" in production.',
        'EXPO_PUBLIC_API_URL must be an HTTPS production API URL.',
        'SUPABASE_URL must be an HTTPS production URL.',
        'SUPABASE_PUBLISHABLE_KEY is required in production.',
        'UPSTASH_REDIS_REST_URL must be an HTTPS URL in production.',
        'UPSTASH_REDIS_REST_TOKEN is required in production.',
      ]),
    );
  });

  test('server-runtime subset never flags client/build-only vars', () => {
    const { EAS_PROJECT_ID, IOS_BUNDLE_IDENTIFIER, ANDROID_PACKAGE, ...serverOnly } = valid;
    void EAS_PROJECT_ID;
    void IOS_BUNDLE_IDENTIFIER;
    void ANDROID_PACKAGE;

    expect(validateServerRuntimeEnvironment(serverOnly)).toEqual([]);
  });
});

describe('assertServerRuntimeEnvironmentConfigured', () => {
  // NODE_ENV is typed read-only in this project's Node types; writable at
  // runtime, so route the assignment through an untyped view of process.env.
  const mutableEnv = process.env as Record<string, string | undefined>;
  // Restore exactly what these tests touch and nothing else -- tests/setup-env.ts
  // preloads BACKEND_AUTH_MODE=demo (among others) for every test file sharing
  // this bun test process, and a blind delete of every key in `valid` here
  // would wipe that global default out from under every test file that runs
  // afterward.
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEasBuildProfile = process.env.EAS_BUILD_PROFILE;
  const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      mutableEnv[key] = value;
    }
  };

  afterEach(() => {
    restore('NODE_ENV', originalNodeEnv);
    restore('EAS_BUILD_PROFILE', originalEasBuildProfile);
    restore('UPSTASH_REDIS_REST_URL', originalUpstashUrl);
    restore('UPSTASH_REDIS_REST_TOKEN', originalUpstashToken);
  });

  test('is a no-op outside a production runtime, however incomplete the config', () => {
    mutableEnv.NODE_ENV = 'test';
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    expect(() => assertServerRuntimeEnvironmentConfigured()).not.toThrow();
  });

  test('throws with the specific missing vars when NODE_ENV is production', () => {
    mutableEnv.NODE_ENV = 'production';
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    let caught: unknown;
    try {
      assertServerRuntimeEnvironmentConfigured();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ServerEnvironmentError);
    expect((caught as ServerEnvironmentError).issues).toEqual(
      expect.arrayContaining([
        'UPSTASH_REDIS_REST_URL must be an HTTPS URL in production.',
        'UPSTASH_REDIS_REST_TOKEN is required in production.',
      ]),
    );
  });
});

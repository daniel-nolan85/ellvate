import { describe, expect, test } from 'bun:test';

import { validateProductionEnvironment } from '../../src/platform/environment/server-environment';

const valid = {
  ANDROID_PACKAGE: 'com.llvcommunity.app',
  BACKEND_AUTH_MODE: 'clerk',
  CLERK_SECRET_KEY: 'sk_live_example',
  EAS_PROJECT_ID: 'project-id',
  EXPO_PUBLIC_API_URL: 'https://api.example.com',
  EXPO_PUBLIC_AUTH_MODE: 'clerk',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example',
  IOS_BUNDLE_IDENTIFIER: 'com.llvcommunity.app',
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
});

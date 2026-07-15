export interface ProductionEnvironmentInput {
  readonly ANDROID_PACKAGE?: string;
  readonly BACKEND_AUTH_MODE?: string;
  readonly CLERK_SECRET_KEY?: string;
  readonly EAS_PROJECT_ID?: string;
  readonly EXPO_PUBLIC_API_URL?: string;
  readonly EXPO_PUBLIC_AUTH_MODE?: string;
  readonly EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  readonly EXPO_PUBLIC_MAESTRO_AUTH_MODE?: string;
  readonly EXPO_PUBLIC_MAESTRO_PROFILE_SYNC_FAIL_ONCE?: string;
  readonly IOS_BUNDLE_IDENTIFIER?: string;
  readonly MAESTRO_PROFILE_SYNC_FAIL_ONCE?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly UPSTASH_REDIS_REST_TOKEN?: string;
  readonly UPSTASH_REDIS_REST_URL?: string;
}

const present = (value: string | undefined): boolean => Boolean(value?.trim());

const isHttpsUrl = (value: string | undefined): boolean => {
  try {
    return value ? new URL(value).protocol === 'https:' : false;
  } catch {
    return false;
  }
};

export function validateProductionEnvironment(
  input: ProductionEnvironmentInput,
): readonly string[] {
  const issues: string[] = [];

  if (input.MAESTRO_PROFILE_SYNC_FAIL_ONCE === 'true') {
    issues.push('MAESTRO_PROFILE_SYNC_FAIL_ONCE cannot be enabled in production.');
  }
  if (present(input.EXPO_PUBLIC_MAESTRO_AUTH_MODE)) {
    issues.push('EXPO_PUBLIC_MAESTRO_AUTH_MODE cannot be set in production.');
  }
  if (present(input.EXPO_PUBLIC_MAESTRO_PROFILE_SYNC_FAIL_ONCE)) {
    issues.push(
      'EXPO_PUBLIC_MAESTRO_PROFILE_SYNC_FAIL_ONCE cannot be set in production.',
    );
  }

  if (input.EXPO_PUBLIC_AUTH_MODE !== 'clerk') {
    issues.push('EXPO_PUBLIC_AUTH_MODE must be "clerk" in production.');
  }
  if (input.BACKEND_AUTH_MODE !== 'clerk') {
    issues.push('BACKEND_AUTH_MODE must be "clerk" in production.');
  }
  if (!/^pk_live_/.test(input.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '')) {
    issues.push(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a live Clerk publishable key.',
    );
  }
  if (!/^sk_live_/.test(input.CLERK_SECRET_KEY ?? '')) {
    issues.push('CLERK_SECRET_KEY must be a live Clerk secret key.');
  }
  if (!isHttpsUrl(input.EXPO_PUBLIC_API_URL)) {
    issues.push('EXPO_PUBLIC_API_URL must be an HTTPS production API URL.');
  }
  if (!isHttpsUrl(input.SUPABASE_URL)) {
    issues.push('SUPABASE_URL must be an HTTPS production URL.');
  }
  if (!present(input.SUPABASE_PUBLISHABLE_KEY)) {
    issues.push('SUPABASE_PUBLISHABLE_KEY is required in production.');
  }
  if (!present(input.EAS_PROJECT_ID)) {
    issues.push('EAS_PROJECT_ID is required in production.');
  }
  if (!present(input.IOS_BUNDLE_IDENTIFIER)) {
    issues.push('IOS_BUNDLE_IDENTIFIER is required in production.');
  }
  if (!present(input.ANDROID_PACKAGE)) {
    issues.push('ANDROID_PACKAGE is required in production.');
  }
  if (!isHttpsUrl(input.UPSTASH_REDIS_REST_URL)) {
    issues.push('UPSTASH_REDIS_REST_URL must be an HTTPS URL in production.');
  }
  if (!present(input.UPSTASH_REDIS_REST_TOKEN)) {
    issues.push('UPSTASH_REDIS_REST_TOKEN is required in production.');
  }

  return issues;
}

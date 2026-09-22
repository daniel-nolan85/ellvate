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

// The subset of production config that the running backend server actually
// reads at request time (Clerk verification, Supabase RLS client, the
// distributed rate limiter). Kept separate from the client/build-only checks
// below so it can be asserted inside the request path without depending on
// vars (EAS_PROJECT_ID, IOS_BUNDLE_IDENTIFIER, ANDROID_PACKAGE, ...) that a
// server deployment never has reason to set.
function serverRuntimeIssues(input: ProductionEnvironmentInput): string[] {
  const issues: string[] = [];

  if (input.BACKEND_AUTH_MODE !== 'clerk') {
    issues.push('BACKEND_AUTH_MODE must be "clerk" in production.');
  }
  if (!/^sk_live_/.test(input.CLERK_SECRET_KEY ?? '')) {
    issues.push('CLERK_SECRET_KEY must be a live Clerk secret key.');
  }
  if (!isHttpsUrl(input.SUPABASE_URL)) {
    issues.push('SUPABASE_URL must be an HTTPS production URL.');
  }
  if (!present(input.SUPABASE_PUBLISHABLE_KEY)) {
    issues.push('SUPABASE_PUBLISHABLE_KEY is required in production.');
  }
  if (!isHttpsUrl(input.UPSTASH_REDIS_REST_URL)) {
    issues.push('UPSTASH_REDIS_REST_URL must be an HTTPS URL in production.');
  }
  if (!present(input.UPSTASH_REDIS_REST_TOKEN)) {
    issues.push('UPSTASH_REDIS_REST_TOKEN is required in production.');
  }

  return issues;
}

// The remaining checks only matter for the client bundle / EAS build, never
// for a running server process.
function clientBuildIssues(input: ProductionEnvironmentInput): string[] {
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
  if (!/^pk_live_/.test(input.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '')) {
    issues.push(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a live Clerk publishable key.',
    );
  }
  if (!isHttpsUrl(input.EXPO_PUBLIC_API_URL)) {
    issues.push('EXPO_PUBLIC_API_URL must be an HTTPS production API URL.');
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

  return issues;
}

// Full production readiness check (client build + server runtime), used by
// the standalone `bun run check:production` pre-deploy script.
export function validateProductionEnvironment(
  input: ProductionEnvironmentInput,
): readonly string[] {
  return [...clientBuildIssues(input), ...serverRuntimeIssues(input)];
}

// Server-only subset, safe to assert inside a live request handler.
export function validateServerRuntimeEnvironment(
  input: ProductionEnvironmentInput,
): readonly string[] {
  return serverRuntimeIssues(input);
}

export class ServerEnvironmentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Production server environment is misconfigured:\n- ${issues.join('\n- ')}`);
    this.name = 'ServerEnvironmentError';
    this.issues = issues;
  }
}

// Throws once per call when the production server's config is incomplete,
// instead of leaving each dependent request to fail downstream with a
// symptom (a 401 from Upstash, an unrelated 503) that doesn't say why.
// Scoped to an actual production runtime (matching the precedent in
// src/backend/testing/fault-injection.ts) so local dev and `bun test` --
// which legitimately run Clerk mode without every production secret set,
// see tests/backend/http.test.ts -- are never affected.
export function assertServerRuntimeEnvironmentConfigured(): void {
  const isProductionRuntime =
    process.env.NODE_ENV === 'production' ||
    process.env.EAS_BUILD_PROFILE === 'production';
  if (!isProductionRuntime) {
    return;
  }

  const issues = validateServerRuntimeEnvironment(
    process.env as unknown as ProductionEnvironmentInput,
  );
  if (issues.length > 0) {
    throw new ServerEnvironmentError(issues);
  }
}

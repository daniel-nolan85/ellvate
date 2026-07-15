const consumedProfileFailures = new Set<string>();

// Development-only fault injection gives Maestro a deterministic way to prove
// the onboarding retry path. Production validation rejects this variable, and
// the guard below also refuses to activate it in production runtimes.
export function consumeProfileSyncFailure(userId: string): boolean {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.EAS_BUILD_PROFILE === 'production' ||
    process.env.MAESTRO_PROFILE_SYNC_FAIL_ONCE !== 'true'
  ) {
    return false;
  }

  if (consumedProfileFailures.has(userId)) {
    return false;
  }

  consumedProfileFailures.add(userId);
  return true;
}

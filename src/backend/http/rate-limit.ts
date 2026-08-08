import { checkDistributedRateLimit, type RateLimitPolicy } from '@/src/services/rate-limit';

import { getBackendAuthMode } from './auth';

export type { RateLimitPolicy } from '@/src/services/rate-limit';

// Shared abuse-prevention policies for community write actions. Comments are
// the highest-frequency legitimate action (fast back-and-forth), posts and
// reviews are naturally rarer, and reports get the tightest limit since mass-
// reporting is itself an abuse vector distinct from the content it targets.
export const WRITE_RATE_LIMIT_POLICIES = {
  comment: { keyPrefix: 'llv:write:comment', maxRequests: 20, windowMs: 5 * 60_000 },
  post: { keyPrefix: 'llv:write:post', maxRequests: 10, windowMs: 10 * 60_000 },
  report: { keyPrefix: 'llv:write:report', maxRequests: 10, windowMs: 60 * 60_000 },
  review: { keyPrefix: 'llv:write:review', maxRequests: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

interface MemoryRateLimitEntry {
  count: number;
  windowStartedAt: number;
}

const memoryEntries = new Map<string, MemoryRateLimitEntry>();

function checkMemoryRateLimit(
  key: string,
  policy: RateLimitPolicy,
  now: number,
): boolean {
  const current = memoryEntries.get(key);
  if (!current || now - current.windowStartedAt >= policy.windowMs) {
    memoryEntries.set(key, { count: 1, windowStartedAt: now });
    return true;
  }
  if (current.count >= policy.maxRequests) {
    return false;
  }
  current.count += 1;
  return true;
}

export const resetWriteRateLimits = (): void => {
  memoryEntries.clear();
};

// Community write actions (posts, comments, reviews, reports) are cheap
// compared to the assistant's LLM calls, so this deliberately fails OPEN when
// the distributed limiter is unavailable (Upstash misconfigured or down) --
// a temporary provider outage should degrade to "no rate limiting" for
// everyday content creation, not "nobody can post." Contrast with the
// assistant's rate limiter (src/backend/assistant/rate-limit.ts), which fails
// closed because an unbounded LLM cost is the bigger risk there.
export async function checkWriteRateLimit(
  userId: string,
  policy: RateLimitPolicy,
): Promise<'allowed' | 'limited'> {
  if (
    process.env.WRITE_RATE_LIMIT_MODE === 'memory' ||
    getBackendAuthMode() === 'demo'
  ) {
    return checkMemoryRateLimit(`${policy.keyPrefix}:${userId}`, policy, Date.now())
      ? 'allowed'
      : 'limited';
  }

  const decision = await checkDistributedRateLimit(userId, policy);
  return decision.status === 'limited' ? 'limited' : 'allowed';
}

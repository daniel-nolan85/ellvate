export interface RateLimitPolicy {
  readonly keyPrefix: string;
  readonly maxRequests: number;
  readonly windowMs: number;
}

export type RateLimitDecision =
  | { readonly status: 'allowed'; readonly count: number }
  | { readonly status: 'limited'; readonly count: number }
  | { readonly status: 'unavailable'; readonly reason: string };

interface UpstashResult {
  readonly result?: unknown;
}

const getUpstashConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { token, url } : null;
};

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export async function checkDistributedRateLimit(
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitDecision> {
  const config = getUpstashConfig();
  if (!config) {
    return {
      reason: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.',
      status: 'unavailable',
    };
  }

  const windowSeconds = Math.max(1, Math.ceil(policy.windowMs / 1000));
  const redisKey = `${policy.keyPrefix}:${key}`;
  const script =
    'local count = redis.call("INCR", KEYS[1]); ' +
    'if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]); end; ' +
    'return count';

  try {
    const response = await fetch(`${config.url}/pipeline`, {
      body: JSON.stringify([
        ['EVAL', script, '1', redisKey, String(windowSeconds)],
      ]),
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      return {
        reason: `rate-limit provider returned ${response.status}`,
        status: 'unavailable',
      };
    }

    const body = (await response.json()) as unknown;
    const result = Array.isArray(body) ? (body[0] as UpstashResult) : null;
    const count = Number(result?.result);
    if (!isPositiveInteger(count)) {
      return {
        reason: 'rate-limit provider returned an invalid counter.',
        status: 'unavailable',
      };
    }

    return count > policy.maxRequests
      ? { count, status: 'limited' }
      : { count, status: 'allowed' };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : 'unknown provider error',
      status: 'unavailable',
    };
  }
}

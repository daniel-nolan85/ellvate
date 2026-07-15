import { afterEach, describe, expect, test } from 'bun:test';

import { checkDistributedRateLimit } from '../../src/services/rate-limit';

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  globalThis.fetch = originalFetch;
});

const policy = { keyPrefix: 'llv:test', maxRequests: 20, windowMs: 60_000 };

describe('distributed assistant rate limit', () => {
  test('fails closed when the shared provider is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    await expect(checkDistributedRateLimit('user-a', policy)).resolves.toEqual({
      reason: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.',
      status: 'unavailable',
    });
  });

  test('uses an atomic provider counter and allows requests under the limit', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com/';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    let capturedRequest: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedRequest = new Request(input, init);
      return Response.json([{ result: 1 }]);
    }) as unknown as typeof fetch;

    await expect(checkDistributedRateLimit('user-a', policy)).resolves.toEqual({
      count: 1,
      status: 'allowed',
    });
    expect(capturedRequest).toBeDefined();
    const request = capturedRequest as Request;
    expect(request.url).toBe('https://redis.example.com/pipeline');
    expect(request.headers.get('authorization')).toBe('Bearer secret');
    expect(await request.json()).toEqual([
      [
        'EVAL',
        expect.stringContaining('redis.call("INCR"'),
        '1',
        'llv:test:user-a',
        '60',
      ],
    ]);
  });

  test('reports a provider counter over the limit as limited', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    globalThis.fetch = (async () =>
      Response.json([{ result: 21 }])) as unknown as typeof fetch;

    await expect(checkDistributedRateLimit('user-a', policy)).resolves.toEqual({
      count: 21,
      status: 'limited',
    });
  });

  test('does not fail open when the provider errors', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    globalThis.fetch = (async () =>
      new Response(null, { status: 503 })) as unknown as typeof fetch;

    await expect(checkDistributedRateLimit('user-a', policy)).resolves.toMatchObject({
      status: 'unavailable',
    });
  });
});

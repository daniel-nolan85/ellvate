import { afterEach, describe, expect, test } from 'bun:test';

import { POST as postComment } from '../../app/api/forum/posts/[id]/comments+api';
import {
  checkWriteRateLimit,
  resetWriteRateLimits,
  WRITE_RATE_LIMIT_POLICIES,
} from '../../src/backend/http';
import { checkDistributedRateLimit } from '../../src/services/rate-limit';
import { resetStore } from '../../src/backend/store';

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalFetch = globalThis.fetch;
const originalBackendAuthMode = process.env.BACKEND_AUTH_MODE;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  if (originalBackendAuthMode === undefined) delete process.env.BACKEND_AUTH_MODE;
  else process.env.BACKEND_AUTH_MODE = originalBackendAuthMode;
  globalThis.fetch = originalFetch;
  resetStore();
  resetWriteRateLimits();
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

describe('checkWriteRateLimit', () => {
  const writePolicy = { keyPrefix: 'llv:test:write', maxRequests: 2, windowMs: 60_000 };

  test('memory mode (demo backend) allows requests under the limit and blocks over it', async () => {
    process.env.BACKEND_AUTH_MODE = 'demo';

    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('allowed');
    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('allowed');
    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('limited');
  });

  test('memory mode tracks each user independently', async () => {
    process.env.BACKEND_AUTH_MODE = 'demo';

    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('allowed');
    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('allowed');
    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('limited');
    expect(await checkWriteRateLimit('user-b', writePolicy)).toBe('allowed');
  });

  // Unlike the assistant's limiter (which fails closed to cap LLM cost), the
  // write-action limiter fails OPEN when the distributed provider is
  // unavailable -- a temporary Upstash outage should not block everyday
  // content creation.
  test('fails open when the distributed provider is unavailable', async () => {
    process.env.BACKEND_AUTH_MODE = 'clerk';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('allowed');
  });

  test('still respects a limited decision from the distributed provider', async () => {
    process.env.BACKEND_AUTH_MODE = 'clerk';
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    globalThis.fetch = (async () =>
      Response.json([{ result: 21 }])) as unknown as typeof fetch;

    expect(await checkWriteRateLimit('user-a', writePolicy)).toBe('limited');
  });
});

describe('write-endpoint rate limiting end to end', () => {
  test('the comment route returns 429 once the shared comment policy is exhausted', async () => {
    process.env.BACKEND_AUTH_MODE = 'demo';
    const makeRequest = () =>
      new Request('http://localhost/api/forum/posts/post-1/comments', {
        body: JSON.stringify({ body: 'hi' }),
        method: 'POST',
      });

    for (let i = 0; i < WRITE_RATE_LIMIT_POLICIES.comment.maxRequests; i += 1) {
      const response = await postComment(makeRequest(), { id: 'post-1' });
      expect(response.status).toBe(201);
    }

    const limited = await postComment(makeRequest(), { id: 'post-1' });
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as { code: string };
    expect(body.code).toBe('rate_limited');
  });
});

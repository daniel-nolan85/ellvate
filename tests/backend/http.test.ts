import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getHealth } from '../../app/api/health+api';
import { getRequestUserId, jsonError, jsonOk } from '../../src/backend/http';

const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;

afterEach(() => {
  if (originalClerkSecretKey === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = originalClerkSecretKey;
  }
});

describe('getRequestUserId', () => {
  test('returns demo-user without an Authorization header', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const request = new Request('http://localhost/api/health');

    expect(await getRequestUserId(request)).toBe('demo-user');
  });

  test('returns demo-user for a bearer token when Clerk is not configured', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const request = new Request('http://localhost/api/health', {
      headers: { Authorization: 'Bearer some-token' },
    });

    expect(await getRequestUserId(request)).toBe('demo-user');
  });

  test('returns demo-user while @clerk/backend verification is stubbed', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    const request = new Request('http://localhost/api/health', {
      headers: { Authorization: 'Bearer some-token' },
    });

    expect(await getRequestUserId(request)).toBe('demo-user');
  });
});

describe('json helpers', () => {
  test('jsonOk returns 200 with the payload', async () => {
    const response = jsonOk({ hello: 'lake' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hello: 'lake' });
  });

  test('jsonOk honors ResponseInit overrides', () => {
    expect(jsonOk({ created: true }, { status: 201 }).status).toBe(201);
  });

  test('jsonError returns the ApiError envelope', async () => {
    const response = jsonError(409, 'mission_locked', 'Mission is locked.');

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'mission_locked',
      message: 'Mission is locked.',
    });
  });
});

describe('GET /api/health', () => {
  test('returns { ok: true }', async () => {
    const response = getHealth();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

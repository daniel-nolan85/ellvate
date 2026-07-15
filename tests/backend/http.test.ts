import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getHealth } from '../../app/api/health+api';
import {
  getRequestUserId,
  getBackendAuthMode,
  jsonError,
  jsonOk,
  withRequestContext,
} from '../../src/backend/http';

const originalClerkSecretKey = process.env.CLERK_SECRET_KEY;
const originalBackendAuthMode = process.env.BACKEND_AUTH_MODE;

afterEach(() => {
  if (originalClerkSecretKey === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = originalClerkSecretKey;
  }
  if (originalBackendAuthMode === undefined) {
    delete process.env.BACKEND_AUTH_MODE;
  } else {
    process.env.BACKEND_AUTH_MODE = originalBackendAuthMode;
  }
});

describe('getRequestUserId', () => {
  test('returns demo-user only in explicit demo mode', async () => {
    process.env.BACKEND_AUTH_MODE = 'demo';
    const request = new Request('http://localhost/api/health');

    expect(await getRequestUserId(request)).toBe('demo-user');
  });

  test('defaults to Clerk mode unless disabled auth explicitly opts into demo', () => {
    delete process.env.BACKEND_AUTH_MODE;
    delete process.env.EXPO_PUBLIC_AUTH_MODE;
    expect(getBackendAuthMode()).toBe('clerk');

    process.env.EXPO_PUBLIC_AUTH_MODE = 'disabled';
    expect(getBackendAuthMode()).toBe('demo');
  });

  test('fails closed when Clerk mode has no secret key', async () => {
    process.env.BACKEND_AUTH_MODE = 'clerk';
    delete process.env.CLERK_SECRET_KEY;
    const request = new Request('http://localhost/api/health');

    await expect(getRequestUserId(request)).rejects.toMatchObject({
      code: 'auth_unavailable',
      status: 503,
    });
  });

  test('fails closed when Clerk mode has no bearer token', async () => {
    process.env.BACKEND_AUTH_MODE = 'clerk';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    const request = new Request('http://localhost/api/health');

    await expect(getRequestUserId(request)).rejects.toMatchObject({
      code: 'auth_required',
      status: 401,
    });
  });

  test('fails closed for an invalid bearer token', async () => {
    process.env.BACKEND_AUTH_MODE = 'clerk';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    const request = new Request('http://localhost/api/health', {
      headers: { Authorization: 'Bearer some-token' },
    });

    await expect(getRequestUserId(request)).rejects.toMatchObject({
      code: 'auth_required',
      status: 401,
    });
  });

  test('converts auth failures to a stable API error envelope', async () => {
    process.env.BACKEND_AUTH_MODE = 'clerk';
    delete process.env.CLERK_SECRET_KEY;
    const response = await withRequestContext(
      new Request('http://localhost/api/profile'),
      async () => new Response('unreachable'),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: 'auth_unavailable',
      message: 'Authentication is not configured for this environment.',
    });
  });

  test('fails closed when Clerk mode has no Supabase data service', async () => {
    process.env.BACKEND_AUTH_MODE = 'clerk';
    delete process.env.CLERK_SECRET_KEY;
    const response = await withRequestContext(
      new Request('http://localhost/api/profile'),
      async () => new Response('unreachable'),
    );

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('auth_unavailable');
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

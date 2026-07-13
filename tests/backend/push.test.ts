import { describe, expect, test } from 'bun:test';

import { POST as postPushToken } from '../../app/api/me/push-token+api';
import { memoryContext } from '../../src/backend/http';
import { storePushToken, validatePushToken } from '../../src/backend/push';

const ctx = memoryContext('demo-user');

describe('validatePushToken', () => {
  test('accepts a valid token and platform', () => {
    const result = validatePushToken({
      platform: 'ios',
      token: 'ExponentPushToken[abc123]',
    });

    expect(result).toEqual({
      ok: true,
      value: { platform: 'ios', token: 'ExponentPushToken[abc123]' },
    });
  });

  test('rejects a missing token', () => {
    expect(validatePushToken({ platform: 'ios' })).toMatchObject({
      ok: false,
      code: 'invalid_token',
    });
  });

  test('rejects an unknown platform', () => {
    expect(
      validatePushToken({ platform: 'blackberry', token: 'x' }),
    ).toMatchObject({ ok: false, code: 'invalid_token' });
  });
});

describe('storePushToken', () => {
  test('accepts a valid token on the memory backend', async () => {
    expect(
      await storePushToken(ctx, {
        platform: 'ios',
        token: 'ExponentPushToken[abc123]',
      }),
    ).toEqual({ ok: true });
  });

  test('rejects an invalid token', async () => {
    expect(await storePushToken(ctx, { token: '' })).toMatchObject({
      ok: false,
      code: 'invalid_token',
    });
  });
});

describe('POST /api/me/push-token', () => {
  const postRequest = (body: unknown) =>
    postPushToken(
      new Request('http://localhost/api/me/push-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  test('stores a valid token and returns 201', async () => {
    const response = await postRequest({
      platform: 'android',
      token: 'ExponentPushToken[abc123]',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });

  test('400s with the ApiError envelope on invalid input', async () => {
    const response = await postRequest({ token: '' });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_token');
  });
});

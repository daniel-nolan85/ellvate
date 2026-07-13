import { describe, expect, test } from 'bun:test';

import { deriveDefaultApiUrl } from '../../src/platform/environment/dev-api-url';

describe('deriveDefaultApiUrl', () => {
  test('uses a web origin even outside development (same-origin API routes)', () => {
    expect(
      deriveDefaultApiUrl('192.168.1.5:8081', false, 'https://app.example.com'),
    ).toBe('https://app.example.com');
  });

  test('returns null for a native build outside development', () => {
    expect(deriveDefaultApiUrl('192.168.1.5:8081', false)).toBeNull();
  });

  test('prefers an explicit web origin when present', () => {
    expect(
      deriveDefaultApiUrl('192.168.1.5:8081', true, 'http://localhost:8081'),
    ).toBe('http://localhost:8081');
  });

  test('derives an http origin from a bare host:port dev server URI', () => {
    expect(deriveDefaultApiUrl('192.168.1.5:8081', true)).toBe(
      'http://192.168.1.5:8081',
    );
  });

  test('keeps an existing scheme on the host URI', () => {
    expect(deriveDefaultApiUrl('http://10.0.0.2:8081', true)).toBe(
      'http://10.0.0.2:8081',
    );
    expect(deriveDefaultApiUrl('https://tunnel.example.dev', true)).toBe(
      'https://tunnel.example.dev',
    );
  });

  test('ignores blank origins and falls through to the host URI', () => {
    expect(deriveDefaultApiUrl('192.168.1.5:8081', true, '   ')).toBe(
      'http://192.168.1.5:8081',
    );
  });

  test('returns null when there is nothing to derive from', () => {
    expect(deriveDefaultApiUrl(undefined, true)).toBeNull();
    expect(deriveDefaultApiUrl(null, true)).toBeNull();
    expect(deriveDefaultApiUrl('   ', true)).toBeNull();
  });
});

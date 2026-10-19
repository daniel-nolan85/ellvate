import { describe, expect, test } from 'bun:test';

import { isBenignNetworkInterruption } from '../../src/services/crash-reporting/benign-network-interruption';

describe('isBenignNetworkInterruption', () => {
  test('matches the iOS "connection lost" error from a backgrounded fetch', () => {
    expect(
      isBenignNetworkInterruption(
        new Error('fetch failed: The network connection was lost.'),
      ),
    ).toBe(true);
  });

  test('matches the iOS "not connected to internet" error, case-insensitively', () => {
    expect(
      isBenignNetworkInterruption(
        new Error('FETCH FAILED: THE INTERNET CONNECTION APPEARS TO BE OFFLINE.'),
      ),
    ).toBe(true);
  });

  test('does not match a genuine timeout', () => {
    expect(isBenignNetworkInterruption(new Error('request timed out'))).toBe(
      false,
    );
  });

  test('does not match an unrelated error', () => {
    expect(isBenignNetworkInterruption(new Error('Unexpected token <'))).toBe(
      false,
    );
  });

  test('does not match a backend 503', () => {
    expect(
      isBenignNetworkInterruption(
        new Error('The application data service is temporarily unavailable.'),
      ),
    ).toBe(false);
  });

  test('handles a non-Error value without throwing', () => {
    expect(isBenignNetworkInterruption('network connection was lost')).toBe(
      true,
    );
    expect(isBenignNetworkInterruption(undefined)).toBe(false);
  });
});

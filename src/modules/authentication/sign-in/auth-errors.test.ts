import { describe, expect, test } from 'bun:test';

import { isMissingIdentifierError, messageForAuthError } from './auth-errors';

describe('authentication error classification', () => {
  test('only treats identifier-not-found errors as sign-up candidates', () => {
    expect(isMissingIdentifierError({ code: 'form_identifier_not_found' })).toBe(true);
    expect(
      isMissingIdentifierError({
        errors: [{ message: "Couldn't find your account." }],
      }),
    ).toBe(true);
    expect(isMissingIdentifierError({ code: 'network_error' })).toBe(false);
    expect(isMissingIdentifierError({ code: 'rate_limit_exceeded' })).toBe(false);
  });

  test('prefers the actionable long message', () => {
    expect(
      messageForAuthError(
        { message: 'short', longMessage: 'The account is unavailable.' },
        'fallback',
      ),
    ).toBe('The account is unavailable.');
  });
});

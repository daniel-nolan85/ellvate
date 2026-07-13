import { describe, expect, test } from 'bun:test';

import { COMPLETE_PHONE_LENGTH, formatPhoneNumber } from './phone-format';

describe('formatPhoneNumber', () => {
  test('returns an empty string when there are no digits', () => {
    expect(formatPhoneNumber('')).toBe('');
    expect(formatPhoneNumber('abc')).toBe('');
  });

  test('progressively formats as digits are typed', () => {
    expect(formatPhoneNumber('70')).toBe('(70');
    expect(formatPhoneNumber('702')).toBe('(702)');
    expect(formatPhoneNumber('7025')).toBe('(702) 5');
    expect(formatPhoneNumber('702555')).toBe('(702) 555');
    expect(formatPhoneNumber('7025550134')).toBe('(702) 555-0134');
  });

  test('strips non-digits and is idempotent on formatted input', () => {
    expect(formatPhoneNumber('(702) 555-0134')).toBe('(702) 555-0134');
  });

  test('caps input at ten digits', () => {
    expect(formatPhoneNumber('70255501349999')).toBe('(702) 555-0134');
  });

  test('a complete number matches the exposed length constant', () => {
    expect(formatPhoneNumber('7025550134')).toHaveLength(COMPLETE_PHONE_LENGTH);
  });
});

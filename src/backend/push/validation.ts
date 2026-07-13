export interface ValidatedPushToken {
  readonly token: string;
  readonly platform: 'ios' | 'android' | 'web';
}

export type PushTokenValidation =
  | { readonly ok: true; readonly value: ValidatedPushToken }
  | {
      readonly ok: false;
      readonly code: 'invalid_token';
      readonly message: string;
    };

const PLATFORMS: readonly ValidatedPushToken['platform'][] = [
  'ios',
  'android',
  'web',
];
const MAX_TOKEN_LENGTH = 300;

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export function validatePushToken(input: unknown): PushTokenValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const token = asTrimmedString(raw.token);
  const platform = asTrimmedString(raw.platform);

  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return {
      code: 'invalid_token',
      message: 'A valid Expo push token is required.',
      ok: false,
    };
  }
  if (!PLATFORMS.includes(platform as ValidatedPushToken['platform'])) {
    return {
      code: 'invalid_token',
      message: 'platform must be ios, android, or web.',
      ok: false,
    };
  }

  return {
    ok: true,
    value: { platform: platform as ValidatedPushToken['platform'], token },
  };
}

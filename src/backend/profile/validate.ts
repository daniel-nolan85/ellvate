import type { CommunityRole, NotificationPrefs } from '@/src/backend/store';

export const MAX_INTERESTS = 12;
export const MAX_INTEREST_LENGTH = 40;

const ROLES: readonly CommunityRole[] = [
  'resident',
  'new',
  'business',
  'visitor',
];

const NOTIFICATION_KEYS: readonly (keyof NotificationPrefs)[] = [
  'events',
  'replies',
  'missions',
  'digest',
  'petitions',
];

export const MAX_NAME_LENGTH = 50;

export interface ProfileUpdate {
  readonly name?: string;
  readonly role?: CommunityRole | null;
  readonly interests?: readonly string[];
  readonly notificationPrefs?: Partial<NotificationPrefs>;
  readonly activityVisible?: boolean;
  // Explicit intent signal from the onboarding wizard's own commit step --
  // see profile.ts's isOnboardingComplete for why this replaced a
  // field-based heuristic (role set, 3+ interests). Never true from any
  // other caller of this same PUT (e.g. a later edit from the Profile
  // screen), so it can't retroactively "complete" an account that finished
  // onboarding before this field existed some other way.
  readonly onboardingComplete?: boolean;
}

export interface ProfileValidationFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export interface ProfileValidationSuccess {
  readonly ok: true;
  readonly update: ProfileUpdate;
}

export type ProfileValidationResult =
  | ProfileValidationFailure
  | ProfileValidationSuccess;

const failure = (code: string, message: string): ProfileValidationFailure => ({
  ok: false,
  code,
  message,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCommunityRole = (value: unknown): value is CommunityRole =>
  typeof value === 'string' &&
  (ROLES as readonly string[]).includes(value);

const isInterestList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= MAX_INTERESTS &&
  value.every(
    (item) => typeof item === 'string' && item.length <= MAX_INTEREST_LENGTH,
  );

const isNotificationPrefsUpdate = (
  value: unknown,
): value is Partial<NotificationPrefs> =>
  isRecord(value) &&
  NOTIFICATION_KEYS.every(
    (key) => !(key in value) || typeof value[key] === 'boolean',
  );

export function validateProfileUpdate(input: unknown): ProfileValidationResult {
  if (!isRecord(input)) {
    return failure('invalid_body', 'Request body must be a JSON object.');
  }

  if (
    'name' in input &&
    (typeof input.name !== 'string' ||
      input.name.trim().length === 0 ||
      input.name.trim().length > MAX_NAME_LENGTH)
  ) {
    return failure(
      'invalid_name',
      `name must be a non-empty string of at most ${MAX_NAME_LENGTH} characters.`,
    );
  }

  if ('role' in input && input.role !== null && !isCommunityRole(input.role)) {
    return failure(
      'invalid_role',
      `role must be null or one of: ${ROLES.join(', ')}.`,
    );
  }

  if ('interests' in input && !isInterestList(input.interests)) {
    return failure(
      'invalid_interests',
      `interests must be an array of at most ${MAX_INTERESTS} strings, each at most ${MAX_INTEREST_LENGTH} characters.`,
    );
  }

  if (
    'notificationPrefs' in input &&
    !isNotificationPrefsUpdate(input.notificationPrefs)
  ) {
    return failure(
      'invalid_notification_prefs',
      'notificationPrefs must be an object with boolean events, replies, missions, digest, and petitions fields.',
    );
  }

  if (
    'activityVisible' in input &&
    typeof input.activityVisible !== 'boolean'
  ) {
    return failure(
      'invalid_activity_visible',
      'activityVisible must be a boolean.',
    );
  }

  if (
    'onboardingComplete' in input &&
    typeof input.onboardingComplete !== 'boolean'
  ) {
    return failure(
      'invalid_onboarding_complete',
      'onboardingComplete must be a boolean.',
    );
  }

  return {
    ok: true,
    update: {
      ...('name' in input ? { name: (input.name as string).trim() } : {}),
      ...('role' in input
        ? { role: input.role as CommunityRole | null }
        : {}),
      ...('interests' in input
        ? { interests: [...(input.interests as readonly string[])] }
        : {}),
      ...('notificationPrefs' in input
        ? {
            notificationPrefs: input.notificationPrefs as Partial<NotificationPrefs>,
          }
        : {}),
      ...('activityVisible' in input
        ? { activityVisible: input.activityVisible as boolean }
        : {}),
      ...('onboardingComplete' in input
        ? { onboardingComplete: input.onboardingComplete as boolean }
        : {}),
    },
  };
}

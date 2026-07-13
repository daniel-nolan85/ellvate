import type {
  AiComfortLevel,
  CommunityRole,
  NotificationPrefs,
} from '@/src/backend/store';

export const MAX_INTERESTS = 12;
export const MAX_INTEREST_LENGTH = 40;

const ROLES: readonly CommunityRole[] = [
  'resident',
  'new',
  'business',
  'visitor',
];

const AI_COMFORT_LEVELS: readonly AiComfortLevel[] = ['new', 'casual', 'power'];

const NOTIFICATION_KEYS: readonly (keyof NotificationPrefs)[] = [
  'events',
  'replies',
  'missions',
  'digest',
];

export const MAX_NAME_LENGTH = 50;

export interface ProfileUpdate {
  readonly name?: string;
  readonly role?: CommunityRole | null;
  readonly interests?: readonly string[];
  readonly aiComfort?: AiComfortLevel | null;
  readonly notificationPrefs?: Partial<NotificationPrefs>;
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

const isAiComfortLevel = (value: unknown): value is AiComfortLevel =>
  typeof value === 'string' &&
  (AI_COMFORT_LEVELS as readonly string[]).includes(value);

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
    'aiComfort' in input &&
    input.aiComfort !== null &&
    !isAiComfortLevel(input.aiComfort)
  ) {
    return failure(
      'invalid_ai_comfort',
      `aiComfort must be null or one of: ${AI_COMFORT_LEVELS.join(', ')}.`,
    );
  }

  if (
    'notificationPrefs' in input &&
    !isNotificationPrefsUpdate(input.notificationPrefs)
  ) {
    return failure(
      'invalid_notification_prefs',
      'notificationPrefs must be an object with boolean events, replies, missions, and digest fields.',
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
      ...('aiComfort' in input
        ? { aiComfort: input.aiComfort as AiComfortLevel | null }
        : {}),
      ...('notificationPrefs' in input
        ? {
            notificationPrefs: input.notificationPrefs as Partial<NotificationPrefs>,
          }
        : {}),
    },
  };
}

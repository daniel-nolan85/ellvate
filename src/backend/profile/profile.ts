import { ensureUser, setState } from '@/src/backend/store';
import type {
  AiComfortLevel,
  CommunityRole,
  NotificationPrefs,
  StoredProfile,
} from '@/src/backend/store';

import { validateProfileUpdate } from './validate';
import type { ProfileUpdate, ProfileValidationFailure } from './validate';

export const ONBOARDING_MIN_INTERESTS = 3;

export interface UserProfile {
  readonly userId: string;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly aiComfort: AiComfortLevel | null;
  readonly notificationPrefs: NotificationPrefs;
  readonly onboardedAt: string | null;
}

export interface ProfileResult {
  readonly profile: UserProfile;
}

export interface UpdateProfileSuccess {
  readonly ok: true;
  readonly profile: UserProfile;
}

export type UpdateProfileResult = ProfileValidationFailure | UpdateProfileSuccess;

const toUserProfile = (userId: string, profile: StoredProfile): UserProfile => ({
  userId,
  role: profile.role,
  interests: profile.interests,
  aiComfort: profile.aiComfort,
  notificationPrefs: profile.notificationPrefs,
  onboardedAt: profile.onboardedAt,
});

const mergePrefs = (
  current: NotificationPrefs,
  update: Partial<NotificationPrefs>,
): NotificationPrefs => ({
  events: update.events ?? current.events,
  replies: update.replies ?? current.replies,
  missions: update.missions ?? current.missions,
  digest: update.digest ?? current.digest,
});

const applyUpdate = (
  profile: StoredProfile,
  update: ProfileUpdate,
): StoredProfile => ({
  role: update.role !== undefined ? update.role : profile.role,
  interests: update.interests ?? profile.interests,
  aiComfort:
    update.aiComfort !== undefined ? update.aiComfort : profile.aiComfort,
  notificationPrefs: update.notificationPrefs
    ? mergePrefs(profile.notificationPrefs, update.notificationPrefs)
    : profile.notificationPrefs,
  onboardedAt: profile.onboardedAt,
});

const isOnboardingComplete = (profile: StoredProfile): boolean =>
  profile.role !== null &&
  profile.aiComfort !== null &&
  profile.interests.length >= ONBOARDING_MIN_INTERESTS;

export function getProfile(userId: string): ProfileResult {
  const user = ensureUser(userId);
  return { profile: toUserProfile(userId, user.profile) };
}

export function updateProfile(
  userId: string,
  input: unknown,
): UpdateProfileResult {
  const validation = validateProfileUpdate(input);
  if (!validation.ok) {
    return validation;
  }

  const current = ensureUser(userId).profile;
  const merged = applyUpdate(current, validation.update);
  const next =
    current.onboardedAt === null && isOnboardingComplete(merged)
      ? { ...merged, onboardedAt: new Date().toISOString() }
      : merged;

  setState((state) => ({
    ...state,
    users: state.users.map((user) =>
      user.id === userId ? { ...user, profile: next } : user,
    ),
  }));

  return { ok: true, profile: toUserProfile(userId, next) };
}

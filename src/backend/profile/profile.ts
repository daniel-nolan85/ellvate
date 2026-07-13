import type { RequestContext } from '@/src/backend/http';
import { ensureUser, setState } from '@/src/backend/store';
import type {
  AiComfortLevel,
  CommunityRole,
  NotificationPrefs,
  StoredProfile,
} from '@/src/backend/store';

import { getProfileSupabase, updateProfileSupabase } from './profile-supabase';
import { validateProfileUpdate } from './validate';
import type { ProfileUpdate, ProfileValidationFailure } from './validate';

export const ONBOARDING_MIN_INTERESTS = 3;

// Welcome bonus granted once, the first time a user finishes onboarding, so a
// brand-new member starts with XP on the missions and leaderboard screens.
export const WELCOME_XP = 50;

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

function getProfileMemory(userId: string): ProfileResult {
  const user = ensureUser(userId);
  return { profile: toUserProfile(userId, user.profile) };
}

function updateProfileMemory(
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
  const justOnboarded =
    current.onboardedAt === null && next.onboardedAt !== null;

  setState((state) => ({
    ...state,
    users: state.users.map((user) =>
      user.id === userId
        ? {
            ...user,
            name: validation.update.name ?? user.name,
            profile: next,
            xp: justOnboarded ? user.xp + WELCOME_XP : user.xp,
          }
        : user,
    ),
  }));

  return { ok: true, profile: toUserProfile(userId, next) };
}

export async function getProfile(
  ctx: RequestContext,
): Promise<ProfileResult> {
  return ctx.supabase
    ? getProfileSupabase(ctx.supabase, ctx.userId)
    : getProfileMemory(ctx.userId);
}

export async function updateProfile(
  ctx: RequestContext,
  input: unknown,
): Promise<UpdateProfileResult> {
  return ctx.supabase
    ? updateProfileSupabase(ctx.supabase, ctx.userId, input)
    : updateProfileMemory(ctx.userId, input);
}

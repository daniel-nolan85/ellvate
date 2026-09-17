import { extractAvatarUpload } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { ensureUser, setState } from '@/src/backend/store';
import type {
  CommunityRole,
  NotificationPrefs,
  StoredProfile,
} from '@/src/backend/store';
import { recordXpLedgerEntry } from '@/src/backend/xp';

import { getProfileSupabase, updateProfileSupabase } from './profile-supabase';
import { validateProfileUpdate } from './validate';
import type { ProfileUpdate, ProfileValidationFailure } from './validate';

// Welcome bonus granted once, the first time a user finishes onboarding, so a
// brand-new member starts with XP on the missions and leaderboard screens.
export const WELCOME_XP = 50;

export interface UserProfile {
  readonly userId: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly notificationPrefs: NotificationPrefs;
  readonly onboardedAt: string | null;
  readonly activityVisible: boolean;
}

export interface ProfileResult {
  readonly profile: UserProfile;
}

export interface UpdateProfileSuccess {
  readonly ok: true;
  readonly profile: UserProfile;
  // Internal to the backend -- lets the updateProfile wrapper record an xp
  // ledger entry for the welcome bonus without re-deriving the before/after
  // onboardedAt transition itself. Never returned to the client (the API
  // route picks only `profile` off this result).
  readonly justOnboarded: boolean;
}

export type UpdateProfileResult = ProfileValidationFailure | UpdateProfileSuccess;

const toUserProfile = (
  userId: string,
  name: string,
  profile: StoredProfile,
  avatarUrl: string | null,
): UserProfile => ({
  userId,
  name,
  avatarUrl,
  role: profile.role,
  interests: profile.interests,
  notificationPrefs: profile.notificationPrefs,
  onboardedAt: profile.onboardedAt,
  activityVisible: profile.activityVisible,
});

const mergePrefs = (
  current: NotificationPrefs,
  update: Partial<NotificationPrefs>,
): NotificationPrefs => ({
  events: update.events ?? current.events,
  replies: update.replies ?? current.replies,
  missions: update.missions ?? current.missions,
  digest: update.digest ?? current.digest,
  petitions: update.petitions ?? current.petitions,
});

const applyUpdate = (
  profile: StoredProfile,
  update: ProfileUpdate,
): StoredProfile => ({
  role: update.role !== undefined ? update.role : profile.role,
  interests: update.interests ?? profile.interests,
  notificationPrefs: update.notificationPrefs
    ? mergePrefs(profile.notificationPrefs, update.notificationPrefs)
    : profile.notificationPrefs,
  onboardedAt: profile.onboardedAt,
  activityVisible:
    update.activityVisible !== undefined
      ? update.activityVisible
      : profile.activityVisible,
});

function getProfileMemory(userId: string): ProfileResult {
  const user = ensureUser(userId);
  return {
    profile: toUserProfile(userId, user.name, user.profile, user.avatarUrl),
  };
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
    current.onboardedAt === null && validation.update.onboardingComplete === true
      ? { ...merged, onboardedAt: new Date().toISOString() }
      : merged;
  const justOnboarded =
    current.onboardedAt === null && next.onboardedAt !== null;
  const avatarUpload = extractAvatarUpload(input);

  const updated = setState((state) => ({
    ...state,
    users: state.users.map((user) =>
      user.id === userId
        ? {
            ...user,
            avatarUrl: avatarUpload ? avatarUpload.dataUrl : user.avatarUrl,
            name: validation.update.name ?? user.name,
            profile: next,
            xp: justOnboarded ? user.xp + WELCOME_XP : user.xp,
          }
        : user,
    ),
  }));
  const updatedUser = updated.users.find((user) => user.id === userId);
  const avatarUrl = updatedUser?.avatarUrl ?? null;

  return {
    justOnboarded,
    ok: true,
    profile: toUserProfile(userId, updatedUser?.name ?? '', next, avatarUrl),
  };
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
  const result = ctx.supabase
    ? await updateProfileSupabase(ctx.supabase, ctx.userId, input)
    : updateProfileMemory(ctx.userId, input);

  if (result.ok && result.justOnboarded) {
    await recordXpLedgerEntry(ctx, {
      amount: WELCOME_XP,
      reason: 'onboarding_bonus',
    });
  }

  return result;
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractAvatarUpload } from '@/src/backend/media';
import { defaultDisplayName } from '@/src/backend/store';
import type { CommunityRole, NotificationPrefs } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';
import { removeStorageObjects, uploadDataUrl } from '@/src/services/storage';

import { ONBOARDING_MIN_INTERESTS, WELCOME_XP } from './profile';
import type { ProfileResult, UpdateProfileResult, UserProfile } from './profile';
import { validateProfileUpdate } from './validate';
import type { ProfileUpdate } from './validate';

const PROFILE_SELECT =
  'name,avatar_url,role,interests,notif_events,notif_replies,notif_missions,notif_digest,notif_petitions,onboarded_at,activity_visible';

interface AppUserProfileRow {
  readonly name: string;
  readonly avatar_url: string | null;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly notif_events: boolean;
  readonly notif_replies: boolean;
  readonly notif_missions: boolean;
  readonly notif_digest: boolean;
  readonly notif_petitions: boolean;
  readonly onboarded_at: string | null;
  readonly activity_visible: boolean;
}

const toUserProfile = (
  userId: string,
  row: AppUserProfileRow,
): UserProfile => ({
  userId,
  name: row.name,
  avatarUrl: row.avatar_url,
  role: row.role,
  interests: row.interests,
  notificationPrefs: {
    events: row.notif_events,
    replies: row.notif_replies,
    missions: row.notif_missions,
    digest: row.notif_digest,
    petitions: row.notif_petitions,
  },
  onboardedAt: row.onboarded_at,
  activityVisible: row.activity_visible,
});

// A new Clerk user has no app_users row yet; create it before any owned write so
// RLS-scoped updates target an existing row. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = defaultDisplayName(userId),
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure profile user');
};

const fetchProfileRow = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<AppUserProfileRow> => {
  const { data, error } = await supabase
    .from('app_users')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single();
  throwIfSupabaseError(error, 'load profile');
  if (!data) {
    throw new Error('load profile: profile not found.');
  }
  return data as unknown as AppUserProfileRow;
};

const mergedPrefs = (
  row: AppUserProfileRow,
  update: Partial<NotificationPrefs> | undefined,
): NotificationPrefs => ({
  events: update?.events ?? row.notif_events,
  replies: update?.replies ?? row.notif_replies,
  missions: update?.missions ?? row.notif_missions,
  digest: update?.digest ?? row.notif_digest,
  petitions: update?.petitions ?? row.notif_petitions,
});

const mergedRow = (
  current: AppUserProfileRow,
  update: ProfileUpdate,
): AppUserProfileRow => {
  const role = update.role !== undefined ? update.role : current.role;
  const interests = update.interests ?? current.interests;
  const activityVisible =
    update.activityVisible !== undefined
      ? update.activityVisible
      : current.activity_visible;
  const prefs = mergedPrefs(current, update.notificationPrefs);
  const complete =
    role !== null && interests.length >= ONBOARDING_MIN_INTERESTS;
  const onboardedAt =
    current.onboarded_at === null && complete
      ? new Date().toISOString()
      : current.onboarded_at;
  return {
    name: current.name,
    avatar_url: current.avatar_url,
    role,
    interests,
    notif_events: prefs.events,
    notif_replies: prefs.replies,
    notif_missions: prefs.missions,
    notif_digest: prefs.digest,
    notif_petitions: prefs.petitions,
    onboarded_at: onboardedAt,
    activity_visible: activityVisible,
  };
};

export async function getProfileSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileResult> {
  await ensureUser(supabase, userId);
  const row = await fetchProfileRow(supabase, userId);
  return { profile: toUserProfile(userId, row) };
}

export async function updateProfileSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<UpdateProfileResult> {
  const validation = validateProfileUpdate(input);
  if (!validation.ok) {
    return validation;
  }
  await ensureUser(supabase, userId);
  const current = await fetchProfileRow(supabase, userId);
  const next = mergedRow(current, validation.update);
  const justOnboarded =
    current.onboarded_at === null && next.onboarded_at !== null;

  let payload: Record<string, unknown> = {
    ...next,
    ...(validation.update.name ? { name: validation.update.name } : {}),
  };

  const avatarUpload = extractAvatarUpload(input);
  let replacedAvatarUrl: string | null = null;
  if (avatarUpload) {
    const avatarUrl = await uploadDataUrl(
      supabase,
      avatarUpload.dataUrl,
      avatarUpload.filename,
      'avatars',
      userId,
    );
    if (avatarUrl) {
      payload = { ...payload, avatar_url: avatarUrl };
      replacedAvatarUrl = current.avatar_url;
    }
  }

  if (justOnboarded) {
    const { data: xpRow, error: xpError } = await supabase
      .from('app_users')
      .select('xp')
      .eq('id', userId)
      .single();
    throwIfSupabaseError(xpError, 'load profile welcome XP');
    payload = {
      ...payload,
      xp: ((xpRow?.xp as number | undefined) ?? 0) + WELCOME_XP,
    };
  }

  const { data, error } = await supabase
    .from('app_users')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single();
  throwIfSupabaseError(error, 'update profile');
  if (!data) {
    throw new Error('update profile: database returned no profile.');
  }
  if (replacedAvatarUrl) {
    await removeStorageObjects(supabase, [replacedAvatarUrl]);
  }
  return {
    justOnboarded,
    ok: true,
    profile: toUserProfile(userId, data as unknown as AppUserProfileRow),
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AiComfortLevel,
  CommunityRole,
  NotificationPrefs,
} from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { ONBOARDING_MIN_INTERESTS, WELCOME_XP } from './profile';
import type { ProfileResult, UpdateProfileResult, UserProfile } from './profile';
import { validateProfileUpdate } from './validate';
import type { ProfileUpdate } from './validate';

const PROFILE_SELECT =
  'role,interests,ai_comfort,notif_events,notif_replies,notif_missions,notif_digest,onboarded_at';

interface AppUserProfileRow {
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly ai_comfort: AiComfortLevel | null;
  readonly notif_events: boolean;
  readonly notif_replies: boolean;
  readonly notif_missions: boolean;
  readonly notif_digest: boolean;
  readonly onboarded_at: string | null;
}

const toUserProfile = (
  userId: string,
  row: AppUserProfileRow,
): UserProfile => ({
  userId,
  role: row.role,
  interests: row.interests,
  aiComfort: row.ai_comfort,
  notificationPrefs: {
    events: row.notif_events,
    replies: row.notif_replies,
    missions: row.notif_missions,
    digest: row.notif_digest,
  },
  onboardedAt: row.onboarded_at,
});

// A new Clerk user has no app_users row yet; create it before any owned write so
// RLS-scoped updates target an existing row. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = 'Member',
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
});

const mergedRow = (
  current: AppUserProfileRow,
  update: ProfileUpdate,
): AppUserProfileRow => {
  const role = update.role !== undefined ? update.role : current.role;
  const interests = update.interests ?? current.interests;
  const aiComfort =
    update.aiComfort !== undefined ? update.aiComfort : current.ai_comfort;
  const prefs = mergedPrefs(current, update.notificationPrefs);
  const complete =
    role !== null &&
    aiComfort !== null &&
    interests.length >= ONBOARDING_MIN_INTERESTS;
  const onboardedAt =
    current.onboarded_at === null && complete
      ? new Date().toISOString()
      : current.onboarded_at;
  return {
    role,
    interests,
    ai_comfort: aiComfort,
    notif_events: prefs.events,
    notif_replies: prefs.replies,
    notif_missions: prefs.missions,
    notif_digest: prefs.digest,
    onboarded_at: onboardedAt,
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
  return {
    ok: true,
    profile: toUserProfile(userId, data as unknown as AppUserProfileRow),
  };
}

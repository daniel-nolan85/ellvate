import { useCallback, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type CommunityRole = 'resident' | 'new' | 'business' | 'visitor';

export interface NotificationPrefs {
  readonly events: boolean;
  readonly replies: boolean;
  readonly missions: boolean;
  readonly digest: boolean;
  readonly petitions: boolean;
}

export interface OnboardingDraft {
  readonly name: string;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly notificationPrefs: NotificationPrefs;
}

const ONBOARDING_COMPLETE_KEY = '@llv:onboarding-complete-v1';

const initialDraft: OnboardingDraft = {
  interests: [],
  name: '',
  notificationPrefs: {
    digest: true,
    events: true,
    missions: true,
    petitions: true,
    replies: true,
  },
  role: null,
};

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
  return value === 'true';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}

// Lets a signed-out (or deleted) session go through onboarding again next
// time it lands on the index route, instead of the flag permanently sticking
// from a previous session on the same device.
export async function resetOnboardingComplete(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
}

export interface ReturningProfile {
  readonly onboardedAt: string | null;
  readonly name: string;
}

// The on-device flag above only knows about this device. A returning user on
// a new device (or an iOS reinstall, where Clerk's session commonly survives
// in the Keychain even though the app's own storage was wiped) still has
// isOnboardingComplete() come back false there, even though their profile is
// already onboarded server-side. This reads that server truth directly so
// the wizard can be skipped instead of re-run, and pulls the name along with
// it for the "welcome back" greeting rather than a second round trip.
export async function fetchReturningProfile(
  getAccessToken: () => Promise<string | null>,
): Promise<ReturningProfile> {
  const { profile } = await requestJson<{
    readonly profile: { readonly onboardedAt: string | null; readonly name: string };
  }>({
    getAccessToken,
    path: '/api/me/profile',
  });
  return profile;
}

export function useOnboardingState() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const maestroProfileSyncFailure = useRef(false);

  const setName = useCallback((name: string) => {
    setDraft((current) => ({ ...current, name }));
  }, []);

  const setRole = useCallback((role: CommunityRole) => {
    setDraft((current) => ({ ...current, role }));
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    setDraft((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }, []);

  const toggleNotification = useCallback((key: keyof NotificationPrefs) => {
    setDraft((current) => ({
      ...current,
      notificationPrefs: {
        ...current.notificationPrefs,
        [key]: !current.notificationPrefs[key],
      },
    }));
  }, []);

  const completeOnboarding = useCallback(async () => {
    setCompletionError(null);
    try {
      if (
        __DEV__ &&
        process.env.EXPO_PUBLIC_MAESTRO_PROFILE_SYNC_FAIL_ONCE === 'true' &&
        !maestroProfileSyncFailure.current
      ) {
        maestroProfileSyncFailure.current = true;
        throw new Error(
          'Profile sync is temporarily unavailable. Try again.',
        );
      }
      await requestJson({
        body: {
          // Omitted (not sent as an empty string) when the name step was
          // skipped -- the backend rejects an empty name, and skipping should
          // leave whatever name already exists (Clerk-provided or seeded)
          // untouched rather than blanking it out.
          ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
          interests: draft.interests,
          notificationPrefs: draft.notificationPrefs,
          role: draft.role,
        },
        getAccessToken: session.getToken,
        method: 'PUT',
        path: '/api/me/profile',
      });
      await markOnboardingComplete();
      // This PUT bypasses useUpdateProfile's mutation (onboarding runs before
      // any profile screen mounts), so nothing else invalidates the cached
      // profile/forum/leaderboard queries — without this, a profile screen
      // visited earlier in the same session (e.g. before a demo-mode sign
      // out + re-onboard) keeps showing the pre-onboarding data forever.
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['forum'] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      return true;
    } catch (error) {
      setCompletionError(
        error instanceof Error
          ? error.message
          : 'We could not save your profile. Check your connection and try again.',
      );
      return false;
    }
  }, [draft, queryClient, session]);

  return {
    completeOnboarding,
    completionError,
    draft,
    setName,
    setRole,
    toggleInterest,
    toggleNotification,
  };
}

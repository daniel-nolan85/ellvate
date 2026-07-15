import { useCallback, useRef, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type CommunityRole = 'resident' | 'new' | 'business' | 'visitor';
export type AiComfortLevel = 'new' | 'casual' | 'power';

export interface NotificationPrefs {
  readonly events: boolean;
  readonly replies: boolean;
  readonly missions: boolean;
  readonly digest: boolean;
}

export interface OnboardingDraft {
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly aiComfort: AiComfortLevel | null;
  readonly locationGranted: boolean;
  readonly notificationPrefs: NotificationPrefs;
}

const ONBOARDING_COMPLETE_KEY = '@llv:onboarding-complete-v1';

const initialDraft: OnboardingDraft = {
  aiComfort: null,
  interests: [],
  locationGranted: false,
  notificationPrefs: {
    digest: false,
    events: true,
    missions: true,
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

export function useOnboardingState() {
  const session = useSession();
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const maestroProfileSyncFailure = useRef(false);

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

  const setAiComfort = useCallback((aiComfort: AiComfortLevel) => {
    setDraft((current) => ({ ...current, aiComfort }));
  }, []);

  const toggleLocation = useCallback(() => {
    setDraft((current) => ({
      ...current,
      locationGranted: !current.locationGranted,
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
          aiComfort: draft.aiComfort,
          interests: draft.interests,
          notificationPrefs: draft.notificationPrefs,
          role: draft.role,
        },
        getAccessToken: session.getToken,
        method: 'PUT',
        path: '/api/me/profile',
      });
      await markOnboardingComplete();
      return true;
    } catch (error) {
      setCompletionError(
        error instanceof Error
          ? error.message
          : 'We could not save your profile. Check your connection and try again.',
      );
      return false;
    }
  }, [draft, session]);

  return {
    completeOnboarding,
    completionError,
    draft,
    setAiComfort,
    setRole,
    toggleInterest,
    toggleLocation,
    toggleNotification,
  };
}

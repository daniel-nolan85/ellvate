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
  const [isCompleting, setIsCompleting] = useState(false);
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
    // Guards against a double-tap on "Try again" firing two overlapping
    // completion requests -- see 0064_atomic_grant_xp.sql for why the
    // backend itself no longer double-grants the welcome bonus even if this
    // guard is somehow bypassed, but there's no reason to send the second
    // request in the first place.
    if (isCompleting) {
      return false;
    }
    setCompletionError(null);
    setIsCompleting(true);
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
      const response = await requestJson<Record<string, unknown>>({
        body: {
          // Omitted (not sent as an empty string) when the name step was
          // skipped -- the backend rejects an empty name, and skipping should
          // leave whatever name already exists (Clerk-provided or seeded)
          // untouched rather than blanking it out.
          ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
          interests: draft.interests,
          notificationPrefs: draft.notificationPrefs,
          // Explicit intent signal, not a field-completeness heuristic --
          // see validate.ts's ProfileUpdate.onboardingComplete for why. Sent
          // unconditionally here (this call only ever fires from the wizard's
          // own commit step) regardless of whether role/interests were
          // filled in or skipped, so onboardedAt gets set either way and the
          // local "done" flag set right below never diverges from server
          // truth again the way it did when this depended on role being set
          // and 3+ interests being picked.
          onboardingComplete: true,
          role: draft.role,
        },
        getAccessToken: session.getToken,
        method: 'PUT',
        path: '/api/me/profile',
      });
      await markOnboardingComplete();
      // This PUT bypasses useUpdateProfile's mutation (onboarding runs before
      // any profile screen mounts), so nothing else keeps the cached
      // profile/forum/leaderboard queries in sync — without this, a profile
      // screen visited earlier in the same session (e.g. before a demo-mode
      // sign out + re-onboard) keeps showing the pre-onboarding data forever.
      //
      // Writes the PUT's own response straight into the profile cache
      // (matching the shape useProfile's queryFn returns: {profile: ...})
      // rather than only invalidating and waiting on a refetch. A prior
      // version relied solely on invalidateQueries -- correct in theory,
      // but two ways it can still lose the race in practice: (1) with the
      // default 'active' refetchType, an *inactive* match (app/index.tsx's
      // own `useProfile`, the one that routed here, has already unmounted
      // by this point) only gets marked stale, its cached data left
      // untouched, with nothing left to trigger the actual refetch; (2)
      // even with refetchType: 'all' forcing that refetch, the corrected
      // result still has to round-trip a real network request and then
      // survive the query persister's own throttled (1s) write to
      // AsyncStorage before the app can safely close -- force-quitting
      // soon after finishing the wizard, an entirely normal thing to do
      // right after finishing a form, could still capture the stale
      // snapshot. Setting the data directly is synchronous and needs
      // neither. The next cold launch was restoring that stale
      // (onboardedAt: null) snapshot before any live check ran, reading
      // the account as still not onboarded, and looping -- no matter how
      // many times the account had actually completed onboarding
      // server-side.
      queryClient.setQueryData(['profile', session.userId ?? 'me'], response);
      await queryClient.invalidateQueries({ queryKey: ['forum'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'], refetchType: 'all' });
      return true;
    } catch (error) {
      setCompletionError(
        error instanceof Error
          ? error.message
          : 'We could not save your profile. Check your connection and try again.',
      );
      return false;
    } finally {
      setIsCompleting(false);
    }
  }, [draft, queryClient, session, isCompleting]);

  return {
    completeOnboarding,
    completionError,
    draft,
    isCompleting,
    setName,
    setRole,
    toggleInterest,
    toggleNotification,
  };
}

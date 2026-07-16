import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type CommunityRole = 'resident' | 'new' | 'business' | 'visitor';

export interface NotificationPrefs {
  readonly events: boolean;
  readonly replies: boolean;
  readonly missions: boolean;
  readonly digest: boolean;
}

export interface UserProfile {
  readonly userId: string;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly aiComfort: 'new' | 'casual' | 'power' | null;
  readonly notificationPrefs: NotificationPrefs;
  readonly onboardedAt: string | null;
}

interface ProfileResponse {
  readonly profile: UserProfile;
}

interface MemberProfileResponse {
  readonly profile: Pick<UserProfile, 'userId' | 'role' | 'interests'>;
  readonly stats: {
    readonly level: number;
    readonly xp: number;
    readonly streakDays: number;
    readonly missionsCompleted: number;
  };
}

export interface ProfileStats {
  readonly level: number;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly title: string;
}

interface MissionsResponse {
  readonly progress: ProfileStats;
}

export interface ProfileUpdateInput {
  readonly name?: string;
  readonly role?: CommunityRole | null;
  readonly interests?: readonly string[];
  readonly notificationPrefs?: Partial<NotificationPrefs>;
}

const profileKey = (userId: string | null) =>
  ['profile', userId ?? 'me'] as const;

export function useProfile() {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<ProfileResponse>({
        getAccessToken: session.getToken,
        path: '/api/me/profile',
        signal,
      }),
    queryKey: profileKey(session.userId),
  });
}

// A different user's public profile — role, interests, and public stats only,
// never notification prefs or AI comfort, which stay private to the owner.
export function useMemberProfile(userId: string) {
  const session = useSession();

  return useQuery({
    enabled: Boolean(userId),
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<MemberProfileResponse>({
        getAccessToken: session.getToken,
        path: `/api/users/${userId}/profile`,
        signal,
      }),
    queryKey: ['profile', 'member', userId],
  });
}

// Shares the missions query cache so stats stay in sync with the Missions tab.
export function useProfileStats() {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<MissionsResponse>({
        getAccessToken: session.getToken,
        path: '/api/missions',
        signal,
      }),
    queryKey: ['missions', 'view', session.userId ?? 'demo-user'],
    select: (data) => data.progress,
  });
}

export function useUpdateProfile() {
  const session = useSession();
  const queryClient = useQueryClient();
  const queryKey = profileKey(session.userId);

  return useMutation({
    mutationFn: (input: ProfileUpdateInput) =>
      requestJson<ProfileResponse>({
        body: input,
        getAccessToken: session.getToken,
        method: 'PUT',
        path: '/api/me/profile',
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({ queryKey: ['forum'] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

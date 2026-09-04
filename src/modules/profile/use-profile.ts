import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export interface UserProfile {
  readonly userId: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly notificationPrefs: NotificationPrefs;
  readonly onboardedAt: string | null;
  // Opt-in: whether other members can open this user's detailed activity
  // list. Aggregate figures on the profile screen are always visible.
  readonly activityVisible: boolean;
}

interface ProfileResponse {
  readonly profile: UserProfile;
}

export interface MemberActivityStats {
  readonly level: number;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly missionsCreated: number;
  readonly postsCount: number;
  readonly eventsCreated: number;
  readonly eventsAttended: number;
  readonly servicesListed: number;
  readonly petitionsStarted: number;
}

interface MemberProfileResponse {
  readonly profile: Pick<
    UserProfile,
    'userId' | 'name' | 'role' | 'interests' | 'avatarUrl' | 'activityVisible'
  >;
  readonly stats: MemberActivityStats;
}

export interface ProfileStats {
  readonly level: number;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly title: string;
}

interface MissionsResponse {
  readonly progress: ProfileStats;
}

export interface AvatarUploadInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface ProfileUpdateInput {
  readonly name?: string;
  readonly role?: CommunityRole | null;
  readonly interests?: readonly string[];
  readonly notificationPrefs?: Partial<NotificationPrefs>;
  readonly avatar?: AvatarUploadInput;
  readonly activityVisible?: boolean;
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
// never notification prefs, which stay private to the owner.
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

// Shares the missions module's progress query cache so stats stay in sync
// with the Missions tab's XpHero -- fetched independently rather than
// imported across the module boundary (missions/use-missions.ts's
// useMissionsProgress hits the same endpoint and key shape).
export function useProfileStats() {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<MissionsResponse>({
        getAccessToken: session.getToken,
        path: '/api/missions/progress',
        signal,
      }),
    queryKey: ['missions', 'progress', session.userId ?? 'demo-user'],
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

// Irreversible: deletes every post/comment/review/bookmark/etc. the user
// owns and, in Clerk mode, the Clerk account itself — see
// src/backend/account for exactly what's removed vs. orphaned.
export function useDeleteAccount() {
  const session = useSession();

  return useMutation({
    mutationFn: () =>
      requestJson<{ readonly deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: '/api/me/account',
      }),
  });
}

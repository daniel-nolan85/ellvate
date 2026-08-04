import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type MissionStatus = 'active' | 'done';
export type MissionTheme = 'trail' | 'water' | 'village' | 'day' | 'night' | 'social';

export interface MissionMedia {
  readonly url: string;
  readonly filename: string;
}

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface Mission {
  readonly id: string;
  readonly author: PersonRef;
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly status: MissionStatus;
  readonly accepted: boolean;
  readonly stopsDone: number;
  readonly stopsTotal: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme;
  readonly media?: readonly MissionMedia[];
  readonly editedAt: string | null;
}

export interface UserProgress {
  readonly level: number;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly title: string;
}

export interface MissionsView {
  readonly missions: readonly Mission[];
  readonly progress: UserProgress;
}

export interface MyMissionsPage {
  readonly missions: readonly Mission[];
  readonly nextCursor: string | null;
}

export interface CheckInResult {
  readonly mission: Mission;
  readonly awardedXp: number;
  readonly progress: UserProgress;
}

export interface CheckInEntry {
  readonly id: string;
  readonly missionId: string;
  readonly user: PersonRef;
  readonly stopIndex: number;
  readonly completedAt: string;
  readonly photoUrl: string | null;
}

export interface CheckInPhotoInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface NewMissionMediaInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface CreateMissionInput {
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string;
  readonly xp: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme;
  readonly newMedia?: readonly NewMissionMediaInput[];
}

export interface ExistingMissionMediaInput {
  readonly filename: string;
  readonly url: string;
}

export interface UpdateMissionInput {
  readonly missionId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string;
  readonly xp: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme;
  readonly existingMedia?: readonly ExistingMissionMediaInput[];
  readonly newMedia?: readonly NewMissionMediaInput[];
}

const missionsViewKey = (userId: string) =>
  ['missions', 'view', userId] as const;

const advanceMission = (mission: Mission): Mission => {
  const stopsDone = Math.min(mission.stopsDone + 1, mission.stopsTotal);
  return {
    ...mission,
    status: stopsDone >= mission.stopsTotal ? 'done' : mission.status,
    stopsDone,
  };
};

export function useMissionsView() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    meta: {
      persist: true,
      sensitive: false,
    },
    queryFn: ({ signal }) => requestJson<MissionsView>({
      getAccessToken: session.getToken,
      path: '/api/missions',
      signal,
    }),
    queryKey: missionsViewKey(userId),
  });
}

const MY_MISSIONS_PAGE_SIZE = 20;

// The activity hub — missions the caller created or completed, server-scoped
// and paginated rather than filtered client-side from the full community list.
export function useMyMissionsView() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: MyMissionsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<MyMissionsPage>({
        getAccessToken: session.getToken,
        path: `/api/missions/mine?limit=${MY_MISSIONS_PAGE_SIZE}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        signal,
      }),
    queryKey: ['missions', 'mine', userId],
  });
}

export function useCreateMission() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMissionInput) =>
      requestJson<{ readonly mission: Mission }>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/missions',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useUpdateMission() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ missionId, ...body }: UpdateMissionInput) =>
      requestJson<{ readonly mission: Mission }>({
        body,
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/missions/${missionId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export function useDeleteMission() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (missionId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/missions/${missionId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

interface MissionMutationContext {
  readonly previous: MissionsView | undefined;
}

export function useAcceptMission() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';
  const viewKey = missionsViewKey(userId);

  return useMutation<
    { readonly mission: Mission },
    Error,
    string,
    MissionMutationContext
  >({
    mutationFn: (missionId) =>
      requestJson<{ readonly mission: Mission }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/missions/${missionId}/accept`,
      }),
    onError: (_error, _missionId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(viewKey, context.previous);
      }
    },
    onMutate: async (missionId) => {
      await queryClient.cancelQueries({ queryKey: viewKey });
      const previous = queryClient.getQueryData<MissionsView>(viewKey);

      if (previous) {
        queryClient.setQueryData<MissionsView>(viewKey, {
          ...previous,
          missions: previous.missions.map((mission) =>
            mission.id === missionId ? { ...mission, accepted: true } : mission,
          ),
        });
      }

      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export interface CheckInInput {
  readonly missionId: string;
  readonly photo?: CheckInPhotoInput;
}

export function useCheckIn(onMissionComplete?: (awardedXp: number) => void) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';
  const viewKey = missionsViewKey(userId);

  return useMutation<CheckInResult, Error, CheckInInput, MissionMutationContext>({
    mutationFn: ({ missionId, photo }) => requestJson<CheckInResult>({
      body: photo ? { checkInPhoto: photo } : {},
      getAccessToken: session.getToken,
      method: 'POST',
      path: `/api/missions/${missionId}/check-in`,
    }),
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(viewKey, context.previous);
      }
    },
    onMutate: async ({ missionId }) => {
      await queryClient.cancelQueries({ queryKey: viewKey });
      const previous = queryClient.getQueryData<MissionsView>(viewKey);

      if (previous) {
        queryClient.setQueryData<MissionsView>(viewKey, {
          ...previous,
          missions: previous.missions.map((mission) => (
            mission.id === missionId ? advanceMission(mission) : mission
          )),
        });
      }

      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onSuccess: (result) => {
      if (result.awardedXp > 0) {
        void Haptics
          .notificationAsync(Haptics.NotificationFeedbackType.Success)
          .catch(() => undefined);
        // WHY: config-level onSuccess runs unconditionally in TanStack Query's
        // Mutation#execute(), unlike the per-call mutate(vars, {onSuccess})
        // callback, which is gated on the observer still having listeners —
        // and the calling MissionCard can unmount before this resolves (its
        // mission gets optimistically filtered out of "In progress" first).
        onMissionComplete?.(result.awardedXp);
      }
    },
  });
}

const missionCheckInsPath = (missionId: string): `/${string}` =>
  `/api/missions/${missionId}/check-ins`;

export function useMissionCheckIns(missionId: string) {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly checkIns: readonly CheckInEntry[] }>({
        getAccessToken: session.getToken,
        path: missionCheckInsPath(missionId),
        signal,
      }),
    queryKey: ['missions', 'check-ins', session.userId ?? 'demo-user', missionId],
    select: (data) => data.checkIns,
  });
}

export function useReportCheckIn() {
  const session = useSession();

  return useMutation({
    mutationFn: (checkInId: string) =>
      requestJson<{ reported: boolean }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/mission-check-ins/${checkInId}/report`,
      }),
  });
}

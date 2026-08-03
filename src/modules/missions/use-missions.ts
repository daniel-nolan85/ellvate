import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type MissionStatus = 'active' | 'done' | 'locked';
export type MissionIcon = 'Sun' | 'ArrowUp' | 'Star' | 'Moon';

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
  readonly stopsDone: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
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

export interface NewMissionMediaInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface CreateMissionInput {
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string;
  readonly xp: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
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
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
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

interface CheckInContext {
  readonly previous: MissionsView | undefined;
}

export function useCheckIn() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';
  const viewKey = missionsViewKey(userId);

  return useMutation<CheckInResult, Error, string, CheckInContext>({
    mutationFn: (missionId) => requestJson<CheckInResult>({
      getAccessToken: session.getToken,
      method: 'POST',
      path: `/api/missions/${missionId}/check-in`,
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
      }
    },
  });
}

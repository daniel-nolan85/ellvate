import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type MissionStatus = 'active' | 'done' | 'locked';
export type MissionIcon = 'Sun' | 'ArrowUp' | 'Star' | 'Moon';

export interface Mission {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly xp: number;
  readonly status: MissionStatus;
  readonly stopsDone: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
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

export interface CheckInResult {
  readonly mission: Mission;
  readonly awardedXp: number;
  readonly progress: UserProgress;
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

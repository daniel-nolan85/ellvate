import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { maybeRequestReviewAfterFirstMissionComplete } from '@/src/platform/review-prompt';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import { computeLeveledUpTo } from './level-up';

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
  readonly isAdmin: boolean;
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
  readonly theme: MissionTheme | null;
  readonly media?: readonly MissionMedia[];
  readonly editedAt: string | null;
  // Community-wide, not scoped to the viewer.
  readonly acceptedCount: number;
  readonly completedCount: number;
}

export interface UserProgress {
  readonly level: number;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
  readonly missionsCompleted: number;
  readonly title: string;
}

export interface MissionsView {
  readonly missions: readonly Mission[];
  readonly progress: UserProgress;
}

export type MissionFilter = 'available' | 'in-progress' | 'completed';

export interface MissionsPage {
  readonly missions: readonly Mission[];
  readonly nextCursor: string | null;
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
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme | null;
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
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme | null;
  readonly existingMedia?: readonly ExistingMissionMediaInput[];
  readonly newMedia?: readonly NewMissionMediaInput[];
}

const missionsViewKey = (userId: string, filter: MissionFilter) =>
  ['missions', 'view', userId, filter] as const;

const missionsProgressKey = (userId: string) =>
  ['missions', 'progress', userId] as const;

const missionDetailKey = (userId: string, missionId: string) =>
  ['missions', 'view', userId, 'detail', missionId] as const;

const missionsPagePath = (filter: MissionFilter, cursor: string | null): `/${string}` =>
  `/api/missions?filter=${filter}&limit=${DEFAULT_MISSIONS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

const advanceMission = (mission: Mission): Mission => {
  const stopsDone = Math.min(mission.stopsDone + 1, mission.stopsTotal);
  return {
    ...mission,
    status: stopsDone >= mission.stopsTotal ? 'done' : mission.status,
    stopsDone,
  };
};

const DEFAULT_MISSIONS_PAGE_SIZE = 20;

// The main browse feed. Bounded and cursor-paginated on the server (see
// /api/missions) rather than loading every mission in one shot -- callers
// that need a flat list should flatten `data.pages` themselves. Switching
// `filter` re-keys the query and starts a fresh paginated fetch, same as
// useForumPosts switching `forum`.
export function useMissionsView(filter: MissionFilter) {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: MissionsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<MissionsPage>({
        getAccessToken: session.getToken,
        path: missionsPagePath(filter, pageParam),
        signal,
      }),
    queryKey: missionsViewKey(userId, filter),
  });
}

// The viewer's own level/XP stats, decoupled from the (now paginated
// and filtered) missions list -- profile's useProfileStats hits the same
// backend endpoint independently, mirroring how it already duplicated this
// fetch rather than importing across the module boundary.
export function useMissionsProgress() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly progress: UserProgress }>({
        getAccessToken: session.getToken,
        path: '/api/missions/progress',
        signal,
      }),
    queryKey: missionsProgressKey(userId),
    select: (data) => data.progress,
  });
}

// A single mission by id, used by the mission detail screen -- the paginated
// main feed no longer guarantees a given mission is already sitting in some
// cached page (or was ever fetched at all, for a deep link), so the detail
// screen can't just scan useMissionsView's cache anymore. Shares the
// ['missions','view',userId,...] key prefix so the existing mission
// mutations' broad invalidation keeps this in sync too.
export function useMission(missionId: string) {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    enabled: Boolean(missionId),
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly mission: Mission }>({
        getAccessToken: session.getToken,
        path: `/api/missions/${missionId}`,
        signal,
      }),
    queryKey: missionDetailKey(userId, missionId),
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
      // Bumps the creator's "missions created" count on their profile --
      // that count is served by the member-profile endpoint, not the
      // missions endpoints, so it isn't covered by the invalidation above.
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      // Also grants a small amount of XP -- see src/backend/xp -- which the
      // points-history list needs to pick up too.
      void queryClient.invalidateQueries({ queryKey: ['xp', 'ledger'] });
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
      // Deleting a created mission also changes the creator's "missions
      // created" count -- see useCreateMission for why this needs its own
      // invalidation.
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Optimistic updates target only the single-mission detail query -- once the
// list is split into three separately-cached, server-filtered pages, an
// accept/check-in can move a mission from one filter bucket to another
// (e.g. available -> in-progress), which isn't a safe in-place page patch the
// way a simple like-count bump would be. The list falls back to onSettled's
// broad ['missions'] invalidation for correctness instead.
interface MissionDetailMutationContext {
  readonly previous: Mission | undefined;
  readonly previousLevel: number | undefined;
}

export function useAcceptMission() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation<
    { readonly mission: Mission },
    Error,
    string,
    MissionDetailMutationContext
  >({
    mutationFn: (missionId) =>
      requestJson<{ readonly mission: Mission }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/missions/${missionId}/accept`,
      }),
    onError: (_error, missionId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(missionDetailKey(userId, missionId), {
          mission: context.previous,
        });
      }
    },
    onMutate: async (missionId) => {
      const detailKey = missionDetailKey(userId, missionId);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<{ readonly mission: Mission }>(
        detailKey,
      )?.mission;
      const previousLevel = queryClient.getQueryData<{
        readonly progress: UserProgress;
      }>(missionsProgressKey(userId))?.progress.level;

      if (previous) {
        queryClient.setQueryData(detailKey, {
          mission: { ...previous, accepted: true },
        });
      }

      return { previous, previousLevel };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
  });
}

export interface CheckInInput {
  readonly missionId: string;
}

export interface CheckInCelebration {
  readonly awardedXp: number;
  // Set only when this check-in's XP crossed a level boundary -- the level
  // reached, for a bigger/rarer celebration than the routine XP toast.
  readonly leveledUpTo: number | null;
}

export function useCheckIn(onMissionComplete?: (celebration: CheckInCelebration) => void) {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.userId ?? 'demo-user';

  return useMutation<CheckInResult, Error, CheckInInput, MissionDetailMutationContext>({
    mutationFn: ({ missionId }) => requestJson<CheckInResult>({
      getAccessToken: session.getToken,
      method: 'POST',
      path: `/api/missions/${missionId}/check-in`,
    }),
    onError: (_error, { missionId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(missionDetailKey(userId, missionId), {
          mission: context.previous,
        });
      }
    },
    onMutate: async ({ missionId }) => {
      const detailKey = missionDetailKey(userId, missionId);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<{ readonly mission: Mission }>(
        detailKey,
      )?.mission;
      const previousLevel = queryClient.getQueryData<{
        readonly progress: UserProgress;
      }>(missionsProgressKey(userId))?.progress.level;

      if (previous) {
        queryClient.setQueryData(detailKey, { mission: advanceMission(previous) });
      }

      return { previous, previousLevel };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'ledger'] });
    },
    onSuccess: (result, _input, context) => {
      if (result.awardedXp > 0) {
        void Haptics
          .notificationAsync(Haptics.NotificationFeedbackType.Success)
          .catch(() => undefined);
        // awardedXp > 0 only on the check-in that completes a mission's last
        // stop (see backend/missions/check-in.ts) -- this is a real "first
        // ever mission completed" moment for whichever user it happens to.
        // The helper itself is a one-time gate (an AsyncStorage flag), so
        // calling it on every completion is safe -- it only ever actually
        // asks once, on the very first one.
        void maybeRequestReviewAfterFirstMissionComplete().catch(() => undefined);
        // WHY: config-level onSuccess runs unconditionally in TanStack Query's
        // Mutation#execute(), unlike the per-call mutate(vars, {onSuccess})
        // callback, which is gated on the observer still having listeners —
        // and the calling MissionCard can unmount before this resolves (its
        // mission gets optimistically filtered out of "In progress" first).
        onMissionComplete?.({
          awardedXp: result.awardedXp,
          leveledUpTo: computeLeveledUpTo(
            context?.previousLevel,
            result.progress.level,
          ),
        });
      }
    },
  });
}

export function useReportMission() {
  const session = useSession();

  return useMutation({
    mutationFn: ({ missionId, ...submission }: { missionId: string } & ReportSubmission) =>
      requestJson<{ reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/missions/${missionId}/report`,
      }),
  });
}

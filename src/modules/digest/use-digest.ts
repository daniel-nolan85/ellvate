import { useQuery } from '@tanstack/react-query';

import type { CommunityEvent } from '@/src/modules/events';
import type { ForumPost } from '@/src/modules/forum';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface DigestStats {
  readonly newPosts: number;
  readonly eventsHeld: number;
  readonly missionsCompleted: number;
  readonly activeMembers: number;
}

export interface DigestCompletedMission {
  readonly id: string;
  readonly title: string;
  readonly xp: number;
  readonly completedByCount: number;
}

export interface DigestUpcomingEvent {
  readonly id: string;
  readonly title: string;
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly timeLabel: string;
}

export interface DigestUpcomingMission {
  readonly id: string;
  readonly title: string;
  readonly scheduledFor: string;
}

export interface WeeklyDigest {
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly stats: DigestStats;
  readonly popularPosts: readonly ForumPost[];
  readonly popularEvents: readonly CommunityEvent[];
  readonly completedMissions: readonly DigestCompletedMission[];
  readonly comingUpEvents: readonly DigestUpcomingEvent[];
  readonly comingUpMissions: readonly DigestUpcomingMission[];
}

export function useWeeklyDigest(weekStart?: string) {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<WeeklyDigest>({
        getAccessToken: session.getToken,
        path: `/api/digest${weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : ''}`,
        signal,
      }),
    queryKey: ['digest', userId, weekStart ?? 'latest'] as const,
    // The default retry:2 means a genuinely failing request stays isPending
    // through up to 3 attempts plus backoff (~30s+) before ever surfacing as
    // isError -- reads as "stuck loading forever" rather than a fast, clear
    // failure. This screen's own query is the one repeatedly reported as
    // "won't load", so cut that wait down to a single retry.
    retry: 1,
  });
}

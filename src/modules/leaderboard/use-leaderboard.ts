import { useInfiniteQuery } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type LeaderboardRange = 'week' | 'month' | 'all';

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly user: PersonRef;
  readonly isMe: boolean;
  readonly missionsCompleted: number;
  readonly xp: number;
  readonly rankDelta: number;
}

interface LeaderboardPageResponse {
  readonly leaders: readonly LeaderboardEntry[];
  readonly nextCursor: string | null;
}

const LEADERBOARD_PAGE_SIZE = 20;
const leaderboardPagePath = (
  range: LeaderboardRange,
  cursor: string | null,
): `/${string}` =>
  `/api/leaderboard?range=${range}&limit=${LEADERBOARD_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

export function useLeaderboard(range: LeaderboardRange) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: LeaderboardPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: {
      persist: true,
      sensitive: false,
    },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<LeaderboardPageResponse>({
        getAccessToken: () => session.getToken(),
        path: leaderboardPagePath(range, pageParam),
        signal,
      }),
    queryKey: ['leaderboard', 'list', session.userId ?? 'demo-user', range],
  });
}

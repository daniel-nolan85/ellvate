import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface PersonRef {
  readonly id: string;
  readonly name: string;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly user: PersonRef;
  readonly isMe: boolean;
  readonly missionsCompleted: number;
  readonly xp: number;
  readonly rankDelta: number;
}

interface LeaderboardResponse {
  readonly leaders: readonly LeaderboardEntry[];
}

export function useLeaderboard() {
  const session = useSession();

  return useQuery({
    meta: {
      persist: true,
      sensitive: false,
    },
    queryFn: ({ signal }) => requestJson<LeaderboardResponse>({
      getAccessToken: () => session.getToken(),
      path: '/api/leaderboard',
      signal,
    }),
    queryKey: ['leaderboard', 'list', session.userId ?? 'demo-user'],
  });
}

import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface XpGrowthPoint {
  readonly weekStart: string;
  readonly xpEarned: number;
  readonly cumulativeXp: number;
}

export interface XpGrowthResponse {
  readonly points: readonly XpGrowthPoint[];
}

export function useXpGrowth(enabled: boolean) {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useQuery({
    enabled,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      requestJson<XpGrowthResponse>({
        getAccessToken: session.getToken,
        path: '/api/me/xp-growth',
        signal,
      }),
    queryKey: ['xp', 'growth', userId],
  });
}

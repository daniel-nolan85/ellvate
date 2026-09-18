import { useInfiniteQuery } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export type PointsHistoryReason =
  | 'mission_completed'
  | 'mission_created'
  | 'post_created'
  | 'event_created'
  | 'service_created'
  | 'onboarding_bonus';

export interface PointsHistoryEntry {
  readonly id: string;
  readonly amount: number;
  readonly reason: PointsHistoryReason;
  readonly refId: string | null;
  readonly createdAt: string;
}

export interface PointsHistoryPage {
  readonly entries: readonly PointsHistoryEntry[];
  readonly nextCursor: string | null;
}

export type PointsHistoryFilter = 'all' | 'missions' | 'posts' | 'events' | 'services';

// Groups the backend's fine-grained reasons into the handful of filter
// chips the history sheet shows -- 'all' passes no reasons filter through
// to the API at all, so a one-time bonus (onboarding) still shows up there
// even though it has no chip of its own.
const FILTER_REASONS: Readonly<Record<PointsHistoryFilter, readonly PointsHistoryReason[]>> = {
  all: [],
  events: ['event_created'],
  missions: ['mission_completed', 'mission_created'],
  posts: ['post_created'],
  services: ['service_created'],
};

const PAGE_SIZE = 20;

// 'all' passes no month filter through to the API at all. Any other value
// is a "YYYY-MM" string -- see monthOptions() in the screen module for how
// those are generated.
export type PointsHistoryMonth = 'all' | `${number}-${string}`;

const pointsHistoryPath = (
  filter: PointsHistoryFilter,
  month: PointsHistoryMonth,
  cursor: string | null,
): `/${string}` => {
  const reasons = FILTER_REASONS[filter];
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (reasons.length > 0) {
    params.set('reasons', reasons.join(','));
  }
  if (month !== 'all') {
    params.set('month', month);
  }
  if (cursor) {
    params.set('cursor', cursor);
  }
  return `/api/me/xp-ledger?${params.toString()}`;
};

export function usePointsHistory(
  filter: PointsHistoryFilter,
  month: PointsHistoryMonth,
  enabled: boolean,
) {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: PointsHistoryPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<PointsHistoryPage>({
        getAccessToken: session.getToken,
        path: pointsHistoryPath(filter, month, pageParam),
        signal,
      }),
    queryKey: ['xp', 'ledger', userId, filter, month],
  });
}

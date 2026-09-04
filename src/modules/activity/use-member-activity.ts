import { useQuery } from '@tanstack/react-query';

import type { CommunityEvent } from '@/src/modules/events';
import type { ForumPost, MyComment } from '@/src/modules/forum';
import type { Mission } from '@/src/modules/missions';
import type { Petition } from '@/src/modules/petitions';
import type { ServiceListing } from '@/src/modules/services';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface MemberActivity {
  readonly posts: readonly ForumPost[];
  readonly comments: readonly MyComment[];
  readonly events: readonly CommunityEvent[];
  readonly missions: readonly Mission[];
  readonly services: readonly ServiceListing[];
  readonly petitions: readonly Petition[];
}

// A read-only, capped snapshot of another member's activity — see
// app/api/users/[userId]/activity+api.ts for why this doesn't paginate the
// way the caller's own Activity Hub does.
export function useMemberActivity(userId: string) {
  const session = useSession();

  return useQuery({
    enabled: Boolean(userId),
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<MemberActivity>({
        getAccessToken: session.getToken,
        path: `/api/users/${userId}/activity`,
        signal,
      }),
    queryKey: ['activity', 'member', userId],
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface BlockedMember {
  readonly userId: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

interface BlockedMembersResponse {
  readonly blocked: readonly BlockedMember[];
}

export function useBlockedUsers() {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<BlockedMembersResponse>({
        getAccessToken: session.getToken,
        path: '/api/me/blocked',
        signal,
      }),
    queryKey: ['profile', 'blocked', session.userId ?? 'demo-user'],
  });
}

// Toggles a neighbour's block state (backed by the same mute route/table as
// before -- "block" is the user-facing name for this, not a new mechanism).
// Blocking hides their content across every module (forum, comments,
// events, missions, services, reviews), so this invalidates the whole
// query cache on settle rather than enumerating each module's query keys.
export function useBlockUser() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockedUserId: string) =>
      requestJson<{ muted: boolean; mutedUserId: string }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/users/${blockedUserId}/mute`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries();
    },
  });
}

// Reports a member directly (distinct from reporting one of their posts/
// comments/etc.) -- surfaces on their profile so a problem person can be
// flagged to moderators even without any single piece of reportable content.
export function useReportMember() {
  const session = useSession();

  return useMutation({
    mutationFn: ({
      reportedUserId,
      ...submission
    }: { reportedUserId: string } & ReportSubmission) =>
      requestJson<{ readonly reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/users/${reportedUserId}/report`,
      }),
  });
}

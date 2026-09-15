import { useInfiniteQuery, useMutation } from '@tanstack/react-query';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface MissionCheckInPhotoAuthor {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface MissionCheckInPhoto {
  readonly id: string;
  readonly missionId: string;
  readonly author: MissionCheckInPhotoAuthor;
  readonly photoUrl: string;
  readonly completedAt: string;
  readonly stopIndex: number;
}

interface MissionCheckInPhotosPage {
  readonly photos: readonly MissionCheckInPhoto[];
  readonly nextCursor: string | null;
}

const queryMeta = { persist: true, sensitive: false } as const;
const CHECK_IN_PHOTOS_PAGE_SIZE = 30;
const checkInPhotosPath = (
  missionId: string,
  cursor: string | null,
): `/${string}` =>
  `/api/missions/${missionId}/check-in-photos?limit=${CHECK_IN_PHOTOS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

// Newest-first gallery of everyone's optional check-in photos for one
// mission. Bounded and cursor-paginated on the server, same shape as
// useMissionComments -- the only real difference is the sort direction (see
// listMissionCheckInPhotos's own WHY for that).
export function useMissionCheckInPhotos(missionId: string) {
  const session = useSession();

  return useInfiniteQuery({
    enabled: Boolean(missionId),
    getNextPageParam: (lastPage: MissionCheckInPhotosPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: queryMeta,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<MissionCheckInPhotosPage>({
        getAccessToken: session.getToken,
        path: checkInPhotosPath(missionId, pageParam),
        signal,
      }),
    queryKey: ['missions', 'check-in-photos', missionId, session.userId ?? 'demo-user'],
  });
}

export function useReportMissionCheckInPhoto() {
  const session = useSession();

  return useMutation({
    mutationFn: ({ checkInId, ...submission }: { checkInId: string } & ReportSubmission) =>
      requestJson<{ reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/mission-check-ins/${checkInId}/report`,
      }),
  });
}

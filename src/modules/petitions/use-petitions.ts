import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type {
  CreatePetitionInput,
  Petition,
  PetitionsGate,
  PetitionsPage,
  PetitionStatus,
  ToggleSignatureResult,
} from './petitions-types';

const PETITIONS_PAGE_SIZE = 20;

const petitionsGateKey = (userId: string | null) =>
  ['petitions', 'gate', userId ?? 'demo-user'] as const;
const petitionsListKeyPrefix = (userId: string | null) =>
  ['petitions', 'list', userId ?? 'demo-user'] as const;
const petitionsListKey = (userId: string | null, status: PetitionStatus) =>
  [...petitionsListKeyPrefix(userId), status] as const;
const petitionDetailKey = (userId: string | null, petitionId: string) =>
  ['petitions', 'detail', userId ?? 'demo-user', petitionId] as const;

const petitionsPagePath = (status: PetitionStatus, cursor: string | null): `/${string}` =>
  `/api/petitions?status=${status}&limit=${PETITIONS_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

const toggleSigned = (petition: Petition): Petition => ({
  ...petition,
  signatureCount: petition.signatureCount + (petition.signed ? -1 : 1),
  signed: !petition.signed,
});

// UX-only gate check -- the server re-verifies on every create, this just
// decides whether to show the wall or the real screen.
export function usePetitionsGate() {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<PetitionsGate>({
        getAccessToken: session.getToken,
        path: '/api/petitions/gate',
        signal,
      }),
    queryKey: petitionsGateKey(session.userId),
    staleTime: 5 * 60_000,
  });
}

export function usePetitionsPage(status: PetitionStatus = 'open') {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: PetitionsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<PetitionsPage>({
        getAccessToken: session.getToken,
        path: petitionsPagePath(status, pageParam),
        signal,
      }),
    queryKey: petitionsListKey(session.userId, status),
  });
}

export function usePetition(petitionId: string) {
  const session = useSession();

  return useQuery({
    enabled: Boolean(petitionId),
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly petition: Petition }>({
        getAccessToken: session.getToken,
        path: `/api/petitions/${petitionId}`,
        signal,
      }),
    queryKey: petitionDetailKey(session.userId, petitionId),
  });
}

export function useCreatePetition() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePetitionInput) =>
      requestJson<{ readonly petition: Petition }>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/petitions',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: petitionsListKeyPrefix(session.userId) });
    },
  });
}

export function useToggleSignature() {
  const session = useSession();
  const queryClient = useQueryClient();
  const listPrefix = petitionsListKeyPrefix(session.userId);

  return useMutation({
    mutationFn: (petitionId: string) =>
      requestJson<ToggleSignatureResult>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/petitions/${petitionId}/sign`,
      }),
    onMutate: async (petitionId) => {
      void Haptics.selectionAsync().catch(() => undefined);
      const detailKey = petitionDetailKey(session.userId, petitionId);
      // Cancel both -- not just the list -- or an in-flight detail refetch
      // landing after this optimistic patch would silently overwrite it.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listPrefix }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);
      const previousLists = queryClient.getQueriesData<InfiniteData<PetitionsPage>>({
        queryKey: listPrefix,
      });
      const previousDetail = queryClient.getQueryData<{ readonly petition: Petition }>(detailKey);

      queryClient.setQueriesData<InfiniteData<PetitionsPage>>(
        { queryKey: listPrefix },
        (current) =>
          current === undefined
            ? current
            : {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  petitions: page.petitions.map((petition) =>
                    petition.id === petitionId ? toggleSigned(petition) : petition,
                  ),
                })),
              },
      );
      if (previousDetail) {
        queryClient.setQueryData(detailKey, { petition: toggleSigned(previousDetail.petition) });
      }

      return { detailKey, petitionId, previousDetail, previousLists };
    },
    onError: (_error, _petitionId, context) => {
      if (!context) {
        return;
      }
      for (const [key, data] of context.previousLists) {
        queryClient.setQueryData(key, data);
      }
      if (context.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
    },
    // Replace the optimistic guess with the server-confirmed result
    // immediately -- onSettled's invalidation alone would eventually
    // correct it, but only on next observation, leaving a window where a
    // stale/incorrect optimistic value is still on screen.
    onSuccess: (result, petitionId, context) => {
      if (!context) {
        return;
      }
      const previous = context.previousDetail?.petition;
      if (previous) {
        queryClient.setQueryData(context.detailKey, {
          petition: {
            ...previous,
            signatureCount: result.signatureCount,
            signed: result.signed,
            status: result.status,
          },
        });
      }
      queryClient.setQueriesData<InfiniteData<PetitionsPage>>(
        { queryKey: listPrefix },
        (current) =>
          current === undefined
            ? current
            : {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  petitions: page.petitions.map((petition) =>
                    petition.id === petitionId
                      ? {
                          ...petition,
                          signatureCount: result.signatureCount,
                          signed: result.signed,
                          status: result.status,
                        }
                      : petition,
                  ),
                })),
              },
      );
    },
    onSettled: (_result, _error, petitionId) => {
      void queryClient.invalidateQueries({ queryKey: listPrefix });
      void queryClient.invalidateQueries({
        queryKey: petitionDetailKey(session.userId, petitionId),
      });
    },
  });
}

export function useReportPetition() {
  const session = useSession();

  return useMutation({
    mutationFn: (petitionId: string) =>
      requestJson<{ readonly reported: boolean }>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/petitions/${petitionId}/report`,
      }),
  });
}

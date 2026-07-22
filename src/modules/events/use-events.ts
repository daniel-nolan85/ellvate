import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type {
  CommunityEvent,
  CreateEventInput,
  EventsView,
  MyEventsPage,
  ToggleJoinResult,
  UpdateEventInput,
} from './events-types';

const MY_EVENTS_PAGE_SIZE = 20;

const eventsViewKey = (userId: string | null) =>
  ['events', 'view', userId ?? 'demo-user'] as const;
const myEventsViewKey = (userId: string | null) =>
  ['events', 'mine', userId ?? 'demo-user'] as const;

const toggleEventJoin = (event: CommunityEvent): CommunityEvent => ({
  ...event,
  going: event.going + (event.joined ? -1 : 1),
  joined: !event.joined,
});

export function useEventsView() {
  const session = useSession();

  return useQuery({
    meta: {
      persist: true,
      sensitive: false,
    },
    queryFn: ({ signal }) => requestJson<EventsView>({
      getAccessToken: session.getToken,
      path: '/api/events',
      signal,
    }),
    queryKey: eventsViewKey(session.userId),
  });
}

// The activity hub — events the caller created or joined, server-scoped and
// paginated rather than filtered client-side from the full community list.
export function useMyEventsView() {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  return useInfiniteQuery({
    getNextPageParam: (lastPage: MyEventsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<MyEventsPage>({
        getAccessToken: session.getToken,
        path: `/api/events/mine?limit=${MY_EVENTS_PAGE_SIZE}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
        signal,
      }),
    queryKey: myEventsViewKey(userId),
  });
}

export function useCreateEvent() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      requestJson<{ readonly event: CommunityEvent }>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/events',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateEvent() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, ...body }: UpdateEventInput) =>
      requestJson<{ readonly event: CommunityEvent }>({
        body,
        getAccessToken: session.getToken,
        method: 'PATCH',
        path: `/api/events/${eventId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useDeleteEvent() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) =>
      requestJson<{ id: string; deleted: boolean }>({
        getAccessToken: session.getToken,
        method: 'DELETE',
        path: `/api/events/${eventId}`,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useToggleJoin() {
  const session = useSession();
  const queryClient = useQueryClient();
  const queryKey = eventsViewKey(session.userId);

  return useMutation({
    mutationFn: (eventId: string) => requestJson<ToggleJoinResult>({
      getAccessToken: session.getToken,
      method: 'POST',
      path: `/api/events/${eventId}/join`,
    }),
    onMutate: async (eventId) => {
      void Haptics.selectionAsync().catch(() => undefined);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<EventsView>(queryKey);

      queryClient.setQueryData<EventsView>(queryKey, (current) =>
        current === undefined
          ? current
          : {
              ...current,
              events: current.events.map((event) =>
                event.id === eventId ? toggleEventJoin(event) : event,
              ),
            });

      return { previous };
    },
    onError: (_error, _eventId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: myEventsViewKey(session.userId) });
    },
  });
}

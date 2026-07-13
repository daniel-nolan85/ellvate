import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type {
  CommunityEvent,
  CreateEventInput,
  EventsView,
  ToggleJoinResult,
} from './events-types';

const eventsViewKey = (userId: string | null) =>
  ['events', 'view', userId ?? 'demo-user'] as const;

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
    },
  });
}

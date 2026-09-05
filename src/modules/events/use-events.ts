import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type {
  CommunityEvent,
  CreateEventInput,
  EventsPage,
  MyEventsPage,
  PersonRef,
  ToggleJoinResult,
  UpdateEventInput,
} from './events-types';

const MY_EVENTS_PAGE_SIZE = 20;
const EVENTS_PAGE_SIZE = 20;

const eventsViewKeyPrefix = (userId: string | null) =>
  ['events', 'view', userId ?? 'demo-user'] as const;
const eventsViewKey = (userId: string | null, date: string | null) =>
  [...eventsViewKeyPrefix(userId), date ?? 'all'] as const;
const eventDetailKey = (userId: string | null, eventId: string) =>
  ['events', 'view', userId ?? 'demo-user', 'detail', eventId] as const;
const eventDatesKey = (userId: string | null) =>
  ['events', 'dates', userId ?? 'demo-user'] as const;
const myEventsViewKey = (userId: string | null) =>
  ['events', 'mine', userId ?? 'demo-user'] as const;

const eventsPagePath = (date: string | null, cursor: string | null): `/${string}` =>
  `/api/events?limit=${EVENTS_PAGE_SIZE}${date ? `&date=${date}` : ''}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

const toggleEventJoin = (event: CommunityEvent): CommunityEvent => ({
  ...event,
  going: event.going + (event.joined ? -1 : 1),
  joined: !event.joined,
});

// Just the calendar day of every upcoming event -- cheap enough to fetch
// unbounded, unlike the full "Coming up" list below, so the calendar can mark
// every day with an event even before that day's page has been scrolled into
// view.
export function useEventDates() {
  const session = useSession();

  return useQuery({
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly dates: readonly string[] }>({
        getAccessToken: session.getToken,
        path: '/api/events/dates',
        signal,
      }),
    queryKey: eventDatesKey(session.userId),
    select: (data) => data.dates,
  });
}

// The main "Coming up" feed. Bounded and cursor-paginated on the server (see
// /api/events) rather than loading every upcoming event in one shot --
// callers that need a flat list should flatten `data.pages` themselves.
// Passing `date` scopes to a single calendar day (the calendar's tap-a-day
// filter) and re-keys the query, same as useForumPosts switching `forum`.
export function useEventsView(date: string | null = null) {
  const session = useSession();

  return useInfiniteQuery({
    getNextPageParam: (lastPage: EventsPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: true, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<EventsPage>({
        getAccessToken: session.getToken,
        path: eventsPagePath(date, pageParam),
        signal,
      }),
    queryKey: eventsViewKey(session.userId, date),
  });
}

// A single event by id, used by the event detail screen -- the paginated
// main feed no longer guarantees a given event is already sitting in some
// cached page (or was ever fetched at all, for a deep link).
export function useEvent(eventId: string) {
  const session = useSession();

  return useQuery({
    enabled: Boolean(eventId),
    meta: { persist: true, sensitive: false },
    queryFn: ({ signal }) =>
      requestJson<{ readonly event: CommunityEvent }>({
        getAccessToken: session.getToken,
        path: `/api/events/${eventId}`,
        signal,
      }),
    queryKey: eventDetailKey(session.userId, eventId),
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

interface EventAttendeesPageResponse {
  readonly attendees: readonly PersonRef[];
  readonly nextCursor: string | null;
}

const EVENT_ATTENDEES_PAGE_SIZE = 30;
const eventAttendeesPagePath = (
  eventId: string,
  cursor: string | null,
): `/${string}` =>
  `/api/events/${eventId}/attendees?limit=${EVENT_ATTENDEES_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

// The uncapped, paginated attendee roster for the "N going" list — unlike
// the preview stack baked into `event.attendees`, which is capped. Only
// fetched when the modal showing it is actually open (see `enabled`).
export function useEventAttendees(eventId: string, enabled: boolean) {
  const session = useSession();

  return useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: EventAttendeesPageResponse) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: false, sensitive: false },
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      requestJson<EventAttendeesPageResponse>({
        getAccessToken: session.getToken,
        path: eventAttendeesPagePath(eventId, pageParam),
        signal,
      }),
    queryKey: ['events', 'attendees', eventId],
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
  const listPrefix = eventsViewKeyPrefix(session.userId);

  return useMutation({
    mutationFn: (eventId: string) => requestJson<ToggleJoinResult>({
      getAccessToken: session.getToken,
      method: 'POST',
      path: `/api/events/${eventId}/join`,
    }),
    onMutate: async (eventId) => {
      void Haptics.selectionAsync().catch(() => undefined);
      await queryClient.cancelQueries({ queryKey: listPrefix });
      // Joining/leaving only ever changes `going`/`joined` on the same
      // event -- unlike missions' accept/check-in, it never moves the event
      // between filter buckets, so it's safe to patch it in place across
      // every cached page (any date-filter variant) rather than falling
      // back to invalidation. Snapshot every matching query (list pages
      // across date variants, plus the detail query if cached) for rollback.
      const previousLists = queryClient.getQueriesData<InfiniteData<EventsPage>>({
        queryKey: listPrefix,
      });
      const detailKey = eventDetailKey(session.userId, eventId);
      const previousDetail = queryClient.getQueryData<{ readonly event: CommunityEvent }>(
        detailKey,
      );

      queryClient.setQueriesData<InfiniteData<EventsPage>>(
        { queryKey: listPrefix },
        (current) =>
          current === undefined
            ? current
            : {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  events: page.events.map((event) =>
                    event.id === eventId ? toggleEventJoin(event) : event,
                  ),
                })),
              },
      );
      if (previousDetail) {
        queryClient.setQueryData(detailKey, {
          event: toggleEventJoin(previousDetail.event),
        });
      }

      return { eventId, previousDetail, previousLists };
    },
    onError: (_error, _eventId, context) => {
      if (!context) {
        return;
      }
      for (const [key, data] of context.previousLists) {
        queryClient.setQueryData(key, data);
      }
      if (context.previousDetail) {
        queryClient.setQueryData(
          eventDetailKey(session.userId, context.eventId),
          context.previousDetail,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listPrefix });
      void queryClient.invalidateQueries({ queryKey: myEventsViewKey(session.userId) });
    },
  });
}

export function useReportEvent() {
  const session = useSession();

  return useMutation({
    mutationFn: ({ eventId, ...submission }: { eventId: string } & ReportSubmission) =>
      requestJson<{ readonly reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/events/${eventId}/report`,
      }),
  });
}

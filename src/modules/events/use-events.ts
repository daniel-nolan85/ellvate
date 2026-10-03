import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { ReportSubmission } from '@/src/components/shared/report-sheet';
import { activityCountsKey } from '@/src/lib/activity-counts-key';
import { useNotifyXpAwarded, type XpAwardOutcome } from '@/src/modules/xp';
import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type {
  CommunityEvent,
  CreateEventInput,
  EventsPage,
  MyEventsPage,
  PersonRef,
  ToggleInterestedResult,
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

// eventDetailKey also starts with listPrefix, so a plain `{ queryKey:
// listPrefix }` filter (prefix match) catches the detail query too -- whose
// cached value is `{ event }`, not `{ pages: [...] }`. Scoping to keys one
// segment longer than the prefix keeps the list-page patch below from
// matching it and crashing on `current.pages.map` of a non-list cache entry.
const listQueriesFilter = (listPrefix: readonly string[]) => ({
  predicate: (query: { readonly queryKey: readonly unknown[] }) =>
    query.queryKey.length === listPrefix.length + 1,
  queryKey: listPrefix,
});

const eventsPagePath = (
  date: string | null,
  cursor: string | null,
): `/${string}` =>
  `/api/events?limit=${EVENTS_PAGE_SIZE}${date ? `&date=${date}` : ''}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

const toggleEventJoin = (event: CommunityEvent): CommunityEvent => ({
  ...event,
  going: event.going + (event.joined ? -1 : 1),
  joined: !event.joined,
});

const toggleEventInterested = (event: CommunityEvent): CommunityEvent => ({
  ...event,
  interestedCount: event.interestedCount + (event.interested ? -1 : 1),
  interested: !event.interested,
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
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | null;
      signal: AbortSignal;
    }) =>
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
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | null;
      signal: AbortSignal;
    }) =>
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
    getNextPageParam: (lastPage: EventAttendeesPageResponse) =>
      lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: false, sensitive: false },
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | null;
      signal: AbortSignal;
    }) =>
      requestJson<EventAttendeesPageResponse>({
        getAccessToken: session.getToken,
        path: eventAttendeesPagePath(eventId, pageParam),
        signal,
      }),
    queryKey: ['events', 'attendees', eventId],
  });
}

interface EventInterestedPageResponse {
  readonly interested: readonly PersonRef[];
  readonly nextCursor: string | null;
}

const eventInterestedPagePath = (
  eventId: string,
  cursor: string | null,
): `/${string}` =>
  `/api/events/${eventId}/interested-list?limit=${EVENT_ATTENDEES_PAGE_SIZE}${
    cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
  }`;

// The uncapped, paginated "interested" roster for the "N interested" list --
// mirrors useEventAttendees exactly. Only fetched when the modal showing it
// is actually open.
export function useEventInterested(eventId: string, enabled: boolean) {
  const session = useSession();

  return useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: EventInterestedPageResponse) =>
      lastPage.nextCursor,
    initialPageParam: null as string | null,
    meta: { persist: false, sensitive: false },
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | null;
      signal: AbortSignal;
    }) =>
      requestJson<EventInterestedPageResponse>({
        getAccessToken: session.getToken,
        path: eventInterestedPagePath(eventId, pageParam),
        signal,
      }),
    queryKey: ['events', 'interested', eventId],
  });
}

export function useCreateEvent() {
  const session = useSession();
  const queryClient = useQueryClient();
  const notifyXpAwarded = useNotifyXpAwarded();

  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      requestJson<{
        readonly event: CommunityEvent;
        readonly xpAward: XpAwardOutcome;
      }>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/events',
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      // Creating an event also grants a small amount of XP -- see
      // src/backend/xp -- which the profile's XP/level stat and the
      // points-history list and growth chart all need to pick up.
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'ledger'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'growth'] });
      void queryClient.invalidateQueries({
        queryKey: activityCountsKey(session.userId),
      });
      notifyXpAwarded(result.xpAward);
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
      // Deleting an event now also reverses the XP its creation granted
      // (see supabase/migrations/0074_revoke_xp_on_delete.sql) -- the
      // profile's XP/level stat and the points-history list and growth
      // chart all need to pick that up too, same as useCreateEvent's own
      // invalidation on the way up. That includes ['missions']:
      // useProfileStats (the actual source of the XP/level numbers shown on
      // the Profile screen) reads from /api/missions/progress, keyed under
      // ['missions', ...] -- not ['profile'] -- so without this it stayed
      // stale until some other unrelated action happened to invalidate it.
      void queryClient.invalidateQueries({ queryKey: ['missions'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'ledger'] });
      void queryClient.invalidateQueries({ queryKey: ['xp', 'growth'] });
      void queryClient.invalidateQueries({
        queryKey: activityCountsKey(session.userId),
      });
    },
  });
}

export function useToggleJoin() {
  const session = useSession();
  const queryClient = useQueryClient();
  const listPrefix = eventsViewKeyPrefix(session.userId);

  return useMutation({
    mutationFn: (eventId: string) =>
      requestJson<ToggleJoinResult>({
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
      const previousLists = queryClient.getQueriesData<
        InfiniteData<EventsPage>
      >(listQueriesFilter(listPrefix));
      const detailKey = eventDetailKey(session.userId, eventId);
      const previousDetail = queryClient.getQueryData<{
        readonly event: CommunityEvent;
      }>(detailKey);

      queryClient.setQueriesData<InfiniteData<EventsPage>>(
        listQueriesFilter(listPrefix),
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
      void queryClient.invalidateQueries({
        queryKey: myEventsViewKey(session.userId),
      });
      // Joining/leaving an event changes "Events attending" -- My Activity's
      // stat tile for that reads from a separate, unpaginated totals query
      // (see use-activity-counts.ts) that nothing here was invalidating.
      void queryClient.invalidateQueries({
        queryKey: activityCountsKey(session.userId),
      });
    },
  });
}

// Mirrors useToggleJoin exactly, patching interestedCount/interested instead
// of going/joined -- and deliberately does NOT invalidate activityCountsKey
// on settle, since marking interest is not scored anywhere (unlike joining,
// which changes "Events attending").
export function useToggleInterested() {
  const session = useSession();
  const queryClient = useQueryClient();
  const listPrefix = eventsViewKeyPrefix(session.userId);

  return useMutation({
    mutationFn: (eventId: string) =>
      requestJson<ToggleInterestedResult>({
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/events/${eventId}/interested`,
      }),
    onMutate: async (eventId) => {
      void Haptics.selectionAsync().catch(() => undefined);
      await queryClient.cancelQueries({ queryKey: listPrefix });
      const previousLists = queryClient.getQueriesData<
        InfiniteData<EventsPage>
      >(listQueriesFilter(listPrefix));
      const detailKey = eventDetailKey(session.userId, eventId);
      const previousDetail = queryClient.getQueryData<{
        readonly event: CommunityEvent;
      }>(detailKey);

      queryClient.setQueriesData<InfiniteData<EventsPage>>(
        listQueriesFilter(listPrefix),
        (current) =>
          current === undefined
            ? current
            : {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  events: page.events.map((event) =>
                    event.id === eventId ? toggleEventInterested(event) : event,
                  ),
                })),
              },
      );
      if (previousDetail) {
        queryClient.setQueryData(detailKey, {
          event: toggleEventInterested(previousDetail.event),
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
    },
  });
}

export function useReportEvent() {
  const session = useSession();

  return useMutation({
    mutationFn: ({
      eventId,
      ...submission
    }: { eventId: string } & ReportSubmission) =>
      requestJson<{ readonly reported: boolean }>({
        body: submission,
        getAccessToken: session.getToken,
        method: 'POST',
        path: `/api/events/${eventId}/report`,
      }),
  });
}

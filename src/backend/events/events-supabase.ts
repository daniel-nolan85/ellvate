import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type {
  CommunityEvent,
  CreateEventResult,
  EventsView,
  JoinResult,
  PersonRef,
  WeekDay,
} from './types';
import { validateEventInput } from './validation';

const WEEK_SELECT = 'date,day_label,date_label,is_today';
const EVENT_SELECT =
  'id,starts_at,time_label,day_label,date_label,title,place,tag,featured,going_base,seed_attendee_ids';

// Cap the avatar stack to a few faces (seed attendees plus joined users).
const ATTENDEE_LIMIT = 6;

interface WeekDayRow {
  readonly date: string;
  readonly day_label: string;
  readonly date_label: string;
  readonly is_today: boolean;
}

interface EventRow {
  readonly id: string;
  readonly starts_at: string;
  readonly time_label: string;
  readonly day_label: string;
  readonly date_label: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly featured: boolean;
  readonly going_base: number;
  readonly seed_attendee_ids: readonly string[];
}

interface JoinRow {
  readonly event_id: string;
  readonly user_id: string;
}

const toWeekDay = (row: WeekDayRow): WeekDay => ({
  dayLabel: row.day_label,
  dateLabel: row.date_label,
  date: row.date,
  isToday: row.is_today,
});

// A new Clerk user has no app_users row yet; create it before any owned write so
// foreign keys resolve. RLS allows inserting only your own row.
const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
  name = 'Member',
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure event user');
};

const uniqueIds = (ids: readonly string[]): readonly string[] => [
  ...new Set(ids),
];

const toCommunityEvent = (
  row: EventRow,
  joinedIds: readonly string[],
  userId: string,
  nameById: ReadonlyMap<string, string>,
): CommunityEvent => {
  const attendeeIds = uniqueIds([
    ...row.seed_attendee_ids,
    ...joinedIds,
  ]).slice(0, ATTENDEE_LIMIT);
  const attendees: readonly PersonRef[] = attendeeIds.flatMap((id) => {
    const name = nameById.get(id);
    return name ? [{ id, name }] : [];
  });
  return {
    id: row.id,
    startsAt: row.starts_at,
    timeLabel: row.time_label,
    dayLabel: row.day_label,
    dateLabel: row.date_label,
    title: row.title,
    place: row.place,
    tag: row.tag,
    featured: row.featured,
    going: row.going_base + joinedIds.length,
    joined: joinedIds.includes(userId),
    attendees,
  };
};

export async function getEventsViewSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<EventsView> {
  const [weekRes, eventsRes, joinsRes] = await Promise.all([
    supabase.from('week_days').select(WEEK_SELECT).order('date', {
      ascending: true,
    }),
    supabase
      .from('events')
      .select(EVENT_SELECT)
      .order('featured', { ascending: false })
      .order('starts_at', { ascending: true }),
    supabase.from('event_joins').select('event_id,user_id'),
  ]);
  throwIfSupabaseError(weekRes.error, 'load event week');
  throwIfSupabaseError(eventsRes.error, 'load events');
  throwIfSupabaseError(joinsRes.error, 'load event joins');

  const weekRows = (weekRes.data ?? []) as unknown as WeekDayRow[];
  const eventRows = (eventsRes.data ?? []) as unknown as EventRow[];
  const joinRows = (joinsRes.data ?? []) as unknown as JoinRow[];

  const joinedByEvent = (eventId: string): readonly string[] =>
    joinRows.filter((row) => row.event_id === eventId).map((row) => row.user_id);

  const neededIds = uniqueIds([
    ...eventRows.flatMap((row) => [...row.seed_attendee_ids]),
    ...joinRows.map((row) => row.user_id),
  ]);
  const { data: userData, error: userError } = await supabase
    .from('app_users')
    .select('id,name')
    .in('id', [...neededIds]);
  throwIfSupabaseError(userError, 'load event attendees');
  const nameById = new Map(
    (userData ?? []).map((row) => [row.id as string, row.name as string]),
  );

  return {
    week: weekRows.map(toWeekDay),
    events: eventRows.map((row) =>
      toCommunityEvent(row, joinedByEvent(row.id), userId, nameById),
    ),
  };
}

export async function createEventSupabase(
  supabase: SupabaseClient,
  userId: string,
  input: unknown,
): Promise<CreateEventResult> {
  const validation = validateEventInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  await ensureUser(supabase, userId);
  const { data, error } = await supabase
    .from('events')
    .insert({
      created_by: userId,
      starts_at: value.startsAt,
      time_label: value.timeLabel,
      day_label: value.dayLabel,
      date_label: value.dateLabel,
      title: value.title,
      place: value.place,
      tag: value.tag,
      featured: false,
      going_base: 0,
      seed_attendee_ids: [],
    })
    .select(EVENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'create event');
  if (!data) {
    throw new Error('create event: database returned no event.');
  }
  return {
    ok: true,
    event: toCommunityEvent(data as unknown as EventRow, [], userId, new Map()),
  };
}

const recomputeGoing = async (
  supabase: SupabaseClient,
  eventId: string,
  goingBase: number,
): Promise<number> => {
  const { count, error } = await supabase
    .from('event_joins')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  throwIfSupabaseError(error, 'count event joins');
  return goingBase + (count ?? 0);
};

export async function toggleJoinSupabase(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<JoinResult | null> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id,going_base')
    .eq('id', eventId)
    .maybeSingle();
  throwIfSupabaseError(eventError, 'load event');
  if (!event) {
    return null;
  }
  await ensureUser(supabase, userId);

  const { data: existing, error: existingError } = await supabase
    .from('event_joins')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  throwIfSupabaseError(existingError, 'load event membership');

  if (existing) {
    const { error } = await supabase
      .from('event_joins')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    throwIfSupabaseError(error, 'leave event');
  } else {
    const { error } = await supabase
      .from('event_joins')
      .insert({ event_id: eventId, user_id: userId });
    throwIfSupabaseError(error, 'join event');
  }

  const going = await recomputeGoing(
    supabase,
    eventId,
    (event as { going_base: number }).going_base,
  );
  return { id: eventId, going, joined: !existing };
}

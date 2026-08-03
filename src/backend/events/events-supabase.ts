import type { SupabaseClient } from '@supabase/supabase-js';

import { extractExistingMedia, extractMediaUploads } from '@/src/backend/media';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';
import { removeStorageObjects, uploadDataUrl } from '@/src/services/storage';

import type {
  CommunityEvent,
  CreateEventResult,
  EventMedia,
  EventsView,
  JoinResult,
  MyEventsPage,
  PersonRef,
  UpdateEventResult,
  WeekDay,
} from './types';
import { validateEventInput } from './validation';

const WEEK_SELECT = 'date,day_label,date_label,is_today';
const EVENT_SELECT =
  'id,created_by,starts_at,time_label,day_label,date_label,title,place,tag,media,featured,going_base,seed_attendee_ids';

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
  readonly created_by: string;
  readonly starts_at: string;
  readonly time_label: string;
  readonly day_label: string;
  readonly date_label: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly media: readonly EventMedia[] | null;
  readonly featured: boolean;
  readonly going_base: number;
  readonly seed_attendee_ids: readonly string[];
}

interface JoinRow {
  readonly event_id: string;
  readonly user_id: string;
}

type UploadEventMediaResult =
  | { readonly ok: true; readonly media: readonly EventMedia[] }
  | { readonly ok: false; readonly uploaded: readonly EventMedia[] };

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

interface PersonLookup {
  readonly name: string;
  readonly avatarUrl: string | null;
}

const toCommunityEvent = (
  row: EventRow,
  joinedIds: readonly string[],
  userId: string,
  nameById: ReadonlyMap<string, PersonLookup>,
): CommunityEvent => {
  const attendeeIds = uniqueIds([
    ...row.seed_attendee_ids,
    ...joinedIds,
  ]).slice(0, ATTENDEE_LIMIT);
  const attendees: readonly PersonRef[] = attendeeIds.flatMap((id) => {
    const person = nameById.get(id);
    return person
      ? [{ avatarUrl: person.avatarUrl, id, name: person.name }]
      : [];
  });
  const author = nameById.get(row.created_by);
  return {
    id: row.id,
    author: {
      avatarUrl: author?.avatarUrl ?? null,
      id: row.created_by,
      name: author?.name ?? 'Member',
    },
    startsAt: row.starts_at,
    timeLabel: row.time_label,
    dayLabel: row.day_label,
    dateLabel: row.date_label,
    title: row.title,
    place: row.place,
    tag: row.tag,
    media: row.media ?? undefined,
    featured: row.featured,
    going: row.going_base + joinedIds.length,
    joined: joinedIds.includes(userId),
    attendees,
  };
};

// Looks up a single user's display name for use in toCommunityEvent's
// nameById map, used after create/update where only the acting user's name
// is needed (not the full attendee/join roster).
const nameMapFor = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<ReadonlyMap<string, PersonLookup>> => {
  const { data, error } = await supabase
    .from('app_users')
    .select('id,name,avatar_url')
    .eq('id', userId)
    .maybeSingle();
  throwIfSupabaseError(error, 'load event author');
  return new Map(
    data
      ? [
          [
            data.id as string,
            {
              avatarUrl: (data.avatar_url as string | null) ?? null,
              name: data.name as string,
            },
          ],
        ]
      : [],
  );
};

// Uploads each picked image to Supabase Storage under the event's own id.
// WHY: a failed upload is surfaced as `ok: false` (with whatever succeeded so
// far in `uploaded`) rather than silently dropped — publishing an event
// that's missing images the user picked would misrepresent what got saved.
const uploadEventMedia = async (
  supabase: SupabaseClient,
  eventId: string,
  input: unknown,
): Promise<UploadEventMediaResult> => {
  const uploads = extractMediaUploads(input);
  if (uploads.length === 0) {
    return { media: [], ok: true };
  }
  const results = await Promise.all(
    uploads.map(async (upload) => {
      const url = await uploadDataUrl(
        supabase,
        upload.dataUrl,
        upload.filename,
        'events',
        eventId,
      );
      return url ? { filename: upload.filename, url } : null;
    }),
  );
  const succeeded = results.filter(
    (media): media is EventMedia => media !== null,
  );
  if (succeeded.length !== results.length) {
    return { ok: false, uploaded: succeeded };
  }
  return { media: succeeded, ok: true };
};

const MEDIA_UPLOAD_FAILED_MESSAGE =
  'One or more images failed to upload. Please try again.';

// Mirrors isUpcoming in events.ts (memory backend) — events from earlier
// calendar days are hidden from the main "Coming up" list, but an event
// later today still counts as upcoming. getMyEventsViewSupabase does NOT
// apply this, since that's an activity history where past events belong.
function isUpcoming(startsAt: string): boolean {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return Date.parse(startsAt) >= startOfToday.getTime();
}

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
  const allEventRows = (eventsRes.data ?? []) as unknown as EventRow[];
  const eventRows = allEventRows.filter((row) => isUpcoming(row.starts_at));
  const joinRows = (joinsRes.data ?? []) as unknown as JoinRow[];

  const joinedByEvent = (eventId: string): readonly string[] =>
    joinRows.filter((row) => row.event_id === eventId).map((row) => row.user_id);

  const neededIds = uniqueIds([
    ...eventRows.map((row) => row.created_by),
    ...eventRows.flatMap((row) => [...row.seed_attendee_ids]),
    ...joinRows.map((row) => row.user_id),
  ]);
  const { data: userData, error: userError } = await supabase
    .from('app_users')
    .select('id,name,avatar_url')
    .in('id', [...neededIds]);
  throwIfSupabaseError(userError, 'load event attendees');
  const nameById: ReadonlyMap<string, PersonLookup> = new Map(
    (userData ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        name: row.name as string,
      },
    ]),
  );

  return {
    week: weekRows.map(toWeekDay),
    events: eventRows.map((row) =>
      toCommunityEvent(row, joinedByEvent(row.id), userId, nameById),
    ),
  };
}

// Scoped to events the caller created or joined — bounded by one user's own
// activity rather than the whole community's event list (unlike
// getEventsViewSupabase, which every screen but the activity hub needs).
// "created by me" OR "joined by me" can't be expressed as a single
// keyset-limited query, so this fetches both (each bounded by the caller's
// own row count, not the community's) and paginates the merged result.
export async function getMyEventsViewSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
): Promise<MyEventsPage> {
  const [createdRes, myJoinsRes] = await Promise.all([
    supabase.from('events').select(EVENT_SELECT).eq('created_by', userId),
    supabase.from('event_joins').select('event_id').eq('user_id', userId),
  ]);
  throwIfSupabaseError(createdRes.error, 'load my events');
  throwIfSupabaseError(myJoinsRes.error, 'load my event joins');

  const createdRows = (createdRes.data ?? []) as unknown as EventRow[];
  const joinedEventIds = ((myJoinsRes.data ?? []) as { event_id: string }[]).map(
    (row) => row.event_id,
  );
  const createdIds = new Set(createdRows.map((row) => row.id));
  const idsToFetch = joinedEventIds.filter((id) => !createdIds.has(id));

  let joinedRows: readonly EventRow[] = [];
  if (idsToFetch.length > 0) {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .in('id', idsToFetch);
    throwIfSupabaseError(error, 'load joined events');
    joinedRows = (data ?? []) as unknown as EventRow[];
  }

  const eventRows = [...createdRows, ...joinedRows];
  const eventIds = eventRows.map((row) => row.id);

  const { data: joinsData, error: joinsError } = eventIds.length
    ? await supabase.from('event_joins').select('event_id,user_id').in('event_id', eventIds)
    : { data: [] as JoinRow[], error: null };
  throwIfSupabaseError(joinsError, 'load event joins for my events');
  const joinRows = (joinsData ?? []) as unknown as JoinRow[];
  const joinedByEvent = (eventId: string): readonly string[] =>
    joinRows.filter((row) => row.event_id === eventId).map((row) => row.user_id);

  const neededIds = uniqueIds([
    ...eventRows.map((row) => row.created_by),
    ...eventRows.flatMap((row) => [...row.seed_attendee_ids]),
    ...joinRows.map((row) => row.user_id),
  ]);
  const { data: userData, error: userError } = neededIds.length
    ? await supabase.from('app_users').select('id,name,avatar_url').in('id', [...neededIds])
    : { data: [], error: null };
  throwIfSupabaseError(userError, 'load my events attendees');
  const nameById: ReadonlyMap<string, PersonLookup> = new Map(
    (userData ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        name: row.name as string,
      },
    ]),
  );

  const wrapped = eventRows.map((row) => ({
    id: row.id,
    row,
    sortKey: row.starts_at,
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    events: page.items.map((item) =>
      toCommunityEvent(item.row, joinedByEvent(item.row.id), userId, nameById),
    ),
    nextCursor: page.nextCursor,
  };
}

// Fetches specific events by id — used to hydrate bookmarks, which can point
// at any event regardless of authorship or join status.
export async function getEventsByIdsSupabase(
  supabase: SupabaseClient,
  userId: string,
  ids: readonly string[],
): Promise<readonly CommunityEvent[]> {
  const { data, error } = await supabase.from('events').select(EVENT_SELECT).in('id', ids);
  throwIfSupabaseError(error, 'load events by id');
  const eventRows = (data ?? []) as unknown as EventRow[];

  const { data: joinsData, error: joinsError } = await supabase
    .from('event_joins')
    .select('event_id,user_id')
    .in('event_id', ids);
  throwIfSupabaseError(joinsError, 'load event joins for bookmarked events');
  const joinRows = (joinsData ?? []) as unknown as JoinRow[];
  const joinedByEvent = (eventId: string): readonly string[] =>
    joinRows.filter((row) => row.event_id === eventId).map((row) => row.user_id);

  const neededIds = uniqueIds([
    ...eventRows.map((row) => row.created_by),
    ...eventRows.flatMap((row) => [...row.seed_attendee_ids]),
    ...joinRows.map((row) => row.user_id),
  ]);
  const { data: userData, error: userError } = neededIds.length
    ? await supabase.from('app_users').select('id,name,avatar_url').in('id', [...neededIds])
    : { data: [], error: null };
  throwIfSupabaseError(userError, 'load bookmarked events attendees');
  const nameById: ReadonlyMap<string, PersonLookup> = new Map(
    (userData ?? []).map((row) => [
      row.id as string,
      {
        avatarUrl: (row.avatar_url as string | null) ?? null,
        name: row.name as string,
      },
    ]),
  );

  return eventRows.map((row) =>
    toCommunityEvent(row, joinedByEvent(row.id), userId, nameById),
  );
}

// Uncapped roster for the "N going" attendee-list modal — unlike the
// preview stack baked into toCommunityEvent (limited to ATTENDEE_LIMIT),
// this returns everyone. Returns null when the event doesn't exist.
export async function getEventAttendeesSupabase(
  supabase: SupabaseClient,
  eventId: string,
): Promise<readonly PersonRef[] | null> {
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('id,seed_attendee_ids')
    .eq('id', eventId)
    .maybeSingle();
  throwIfSupabaseError(eventError, 'load event');
  if (!eventRow) {
    return null;
  }

  const { data: joinsData, error: joinsError } = await supabase
    .from('event_joins')
    .select('user_id')
    .eq('event_id', eventId);
  throwIfSupabaseError(joinsError, 'load event joins');
  const joinedIds = ((joinsData ?? []) as { user_id: string }[]).map(
    (row) => row.user_id,
  );

  const attendeeIds = uniqueIds([
    ...(eventRow.seed_attendee_ids as readonly string[]),
    ...joinedIds,
  ]);
  if (attendeeIds.length === 0) {
    return [];
  }

  const { data: userData, error: userError } = await supabase
    .from('app_users')
    .select('id,name,avatar_url')
    .in('id', [...attendeeIds]);
  throwIfSupabaseError(userError, 'load event attendee users');
  const byId = new Map(
    (userData ?? []).map((row) => [row.id as string, row]),
  );
  return attendeeIds.flatMap((id) => {
    const row = byId.get(id);
    return row
      ? [
          {
            avatarUrl: (row.avatar_url as string | null) ?? null,
            id,
            name: row.name as string,
          },
        ]
      : [];
  });
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
  const { data: inserted, error: insertError } = await supabase
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
  throwIfSupabaseError(insertError, 'create event');
  if (!inserted) {
    throw new Error('create event: database returned no event.');
  }
  const insertedRow = inserted as unknown as EventRow;
  const nameById = await nameMapFor(supabase, userId);

  const mediaResult = await uploadEventMedia(supabase, insertedRow.id, input);
  if (!mediaResult.ok) {
    await removeStorageObjects(
      supabase,
      mediaResult.uploaded.map((media) => media.url),
    );
    await supabase.from('events').delete().eq('id', insertedRow.id);
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  if (mediaResult.media.length === 0) {
    return {
      ok: true,
      event: toCommunityEvent(insertedRow, [], userId, nameById),
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('events')
    .update({ media: mediaResult.media })
    .eq('id', insertedRow.id)
    .select(EVENT_SELECT)
    .single();
  throwIfSupabaseError(updateError, 'attach event media');
  return {
    ok: true,
    event: toCommunityEvent(
      (updated as unknown as EventRow) ?? insertedRow,
      [],
      userId,
      nameById,
    ),
  };
}

export async function updateEventSupabase(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  input: unknown,
): Promise<UpdateEventResult> {
  const { data: existing, error: existingError } = await supabase
    .from('events')
    .select('id,created_by,media')
    .eq('id', eventId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load event');
  if (!existing) {
    return { code: 'event_not_found', message: 'Event not found.', ok: false };
  }
  if (existing.created_by !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own events.',
      ok: false,
    };
  }
  const validation = validateEventInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const keptMedia = extractExistingMedia(input);
  const uploadResult = await uploadEventMedia(supabase, eventId, input);
  if (!uploadResult.ok) {
    await removeStorageObjects(
      supabase,
      uploadResult.uploaded.map((media) => media.url),
    );
    return {
      code: 'media_upload_failed',
      message: MEDIA_UPLOAD_FAILED_MESSAGE,
      ok: false,
    };
  }
  const media = [...keptMedia, ...uploadResult.media];

  const { data, error } = await supabase
    .from('events')
    .update({
      starts_at: value.startsAt,
      time_label: value.timeLabel,
      day_label: value.dayLabel,
      date_label: value.dateLabel,
      title: value.title,
      place: value.place,
      tag: value.tag,
      media: media.length ? media : null,
    })
    .eq('id', eventId)
    .select(EVENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'update event');
  if (!data) {
    throw new Error('update event: database returned no event.');
  }

  const previousMedia = (existing.media as readonly EventMedia[] | null) ?? [];
  const keptUrls = new Set(keptMedia.map((item) => item.url));
  const removedMedia = previousMedia.filter((item) => !keptUrls.has(item.url));
  await removeStorageObjects(
    supabase,
    removedMedia.map((item) => item.url),
  );

  const row = data as unknown as EventRow;
  const { data: joinRows, error: joinError } = await supabase
    .from('event_joins')
    .select('event_id,user_id')
    .eq('event_id', eventId);
  throwIfSupabaseError(joinError, 'load event joins');
  const joinedIds = ((joinRows ?? []) as unknown as JoinRow[]).map(
    (join) => join.user_id,
  );
  const nameById = await nameMapFor(supabase, userId);
  return { ok: true, event: toCommunityEvent(row, joinedIds, userId, nameById) };
}

export async function deleteEventSupabase(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const { data: existing, error: existingError } = await supabase
    .from('events')
    .select('id,created_by,media')
    .eq('id', eventId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load event');
  if (!existing || existing.created_by !== userId) {
    return false;
  }
  // WHY: clean up Storage before deleting the row — owner-scoped Storage RLS
  // (see 0007) verifies ownership by looking the event back up, so the row
  // must still exist when the cleanup call runs.
  const media = (existing.media as readonly EventMedia[] | null) ?? [];
  await removeStorageObjects(
    supabase,
    media.map((item) => item.url),
  );
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  throwIfSupabaseError(error, 'delete event');
  return true;
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

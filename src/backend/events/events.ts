import { extractExistingMedia, extractMediaUploads } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import type { StoredEvent, StoredUser } from '@/src/backend/store';
import { getState, setState } from '@/src/backend/store';

import {
  createEventSupabase,
  deleteEventSupabase,
  getEventsViewSupabase,
  toggleJoinSupabase,
  updateEventSupabase,
} from './events-supabase';
import type {
  CommunityEvent,
  CreateEventResult,
  EventsView,
  JoinResult,
  PersonRef,
  UpdateEventResult,
} from './types';
import { validateEventInput } from './validation';

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const byFeaturedThenStartsAt = (a: StoredEvent, b: StoredEvent): number => {
  if (a.featured !== b.featured) {
    return a.featured ? -1 : 1;
  }
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
};

const toPersonRefs = (
  attendeeIds: readonly string[],
  users: readonly StoredUser[],
): readonly PersonRef[] =>
  attendeeIds.flatMap((id) => {
    const user = users.find((candidate) => candidate.id === id);
    return user
      ? [{ avatarUrl: user.avatarUrl, id: user.id, name: user.name }]
      : [];
  });

const toAuthorRef = (
  users: readonly StoredUser[],
  authorId: string,
): PersonRef => {
  const user = users.find((candidate) => candidate.id === authorId);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, name: user.name }
    : { avatarUrl: null, id: authorId, name: 'You' };
};

const toCommunityEvent = (
  event: StoredEvent,
  userId: string,
  users: readonly StoredUser[],
): CommunityEvent => ({
  id: event.id,
  author: toAuthorRef(users, event.authorId),
  startsAt: event.startsAt,
  timeLabel: event.timeLabel,
  dayLabel: event.dayLabel,
  dateLabel: event.dateLabel,
  title: event.title,
  place: event.place,
  tag: event.tag,
  media: event.media,
  featured: event.featured,
  going: event.going,
  joined: event.joinedBy.includes(userId),
  attendees: toPersonRefs(event.attendeeIds, users),
});

function getEventsViewMemory(userId: string): EventsView {
  const { events, users, week } = getState();

  return {
    week: week.map((day) => ({ ...day })),
    events: [...events]
      .sort(byFeaturedThenStartsAt)
      .map((event) => toCommunityEvent(event, userId, users)),
  };
}

function createEventMemory(userId: string, input: unknown): CreateEventResult {
  const validation = validateEventInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const mediaUploads = extractMediaUploads(input);
  const stored: StoredEvent = {
    id: `evt-${crypto.randomUUID()}`,
    authorId: userId,
    startsAt: value.startsAt,
    timeLabel: value.timeLabel,
    dayLabel: value.dayLabel,
    dateLabel: value.dateLabel,
    title: value.title,
    place: value.place,
    tag: value.tag,
    media: mediaUploads.length
      ? mediaUploads.map((upload) => ({
          filename: upload.filename,
          url: upload.dataUrl,
        }))
      : undefined,
    featured: false,
    going: 0,
    joinedBy: [],
    attendeeIds: [],
  };
  const next = setState((current) => ({
    ...current,
    events: [stored, ...current.events],
  }));
  return { ok: true, event: toCommunityEvent(stored, userId, next.users) };
}

function updateEventMemory(
  userId: string,
  eventId: string,
  input: unknown,
): UpdateEventResult {
  const existing = getState().events.find((event) => event.id === eventId);
  if (!existing) {
    return { code: 'event_not_found', message: 'Event not found.', ok: false };
  }
  if (existing.authorId !== userId) {
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
  const newMedia = extractMediaUploads(input);
  const media = [
    ...keptMedia,
    ...newMedia.map((upload) => ({
      filename: upload.filename,
      url: upload.dataUrl,
    })),
  ];
  const next = setState((current) => ({
    ...current,
    events: current.events.map((event) =>
      event.id === eventId
        ? {
            ...event,
            startsAt: value.startsAt,
            timeLabel: value.timeLabel,
            dayLabel: value.dayLabel,
            dateLabel: value.dateLabel,
            title: value.title,
            place: value.place,
            tag: value.tag,
            media: media.length ? media : undefined,
          }
        : event,
    ),
  }));
  const updated = next.events.find((event) => event.id === eventId);
  if (!updated) {
    return { code: 'event_not_found', message: 'Event not found.', ok: false };
  }
  return { ok: true, event: toCommunityEvent(updated, userId, next.users) };
}

function deleteEventMemory(userId: string, eventId: string): boolean {
  const existing = getState().events.find(
    (event) => event.id === eventId && event.authorId === userId,
  );
  if (!existing) {
    return false;
  }
  setState((current) => {
    const removedCommentIds = new Set(
      current.eventComments
        .filter((comment) => comment.eventId === eventId)
        .map((comment) => comment.id),
    );
    return {
      ...current,
      eventCommentReports: current.eventCommentReports.filter(
        (report) => !removedCommentIds.has(report.eventCommentId),
      ),
      eventComments: current.eventComments.filter(
        (comment) => comment.eventId !== eventId,
      ),
      events: current.events.filter((event) => event.id !== eventId),
    };
  });
  return true;
}

function toggleJoinMemory(userId: string, eventId: string): JoinResult | null {
  const existing = getState().events.find((event) => event.id === eventId);

  if (!existing) {
    return null;
  }

  const joined = !existing.joinedBy.includes(userId);
  const next = setState((current) => ({
    ...current,
    events: current.events.map((event) =>
      event.id === eventId
        ? {
            ...event,
            going: joined ? event.going + 1 : event.going - 1,
            joinedBy: joined
              ? [...event.joinedBy, userId]
              : event.joinedBy.filter((id) => id !== userId),
          }
        : event,
    ),
  }));

  const updated = next.events.find((event) => event.id === eventId);

  return updated ? { id: updated.id, going: updated.going, joined } : null;
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function getEventsView(ctx: RequestContext): Promise<EventsView> {
  return ctx.supabase
    ? getEventsViewSupabase(ctx.supabase, ctx.userId)
    : getEventsViewMemory(ctx.userId);
}

export async function createEvent(
  ctx: RequestContext,
  input: unknown,
): Promise<CreateEventResult> {
  return ctx.supabase
    ? createEventSupabase(ctx.supabase, ctx.userId, input)
    : createEventMemory(ctx.userId, input);
}

export async function toggleJoin(
  ctx: RequestContext,
  eventId: string,
): Promise<JoinResult | null> {
  return ctx.supabase
    ? toggleJoinSupabase(ctx.supabase, ctx.userId, eventId)
    : toggleJoinMemory(ctx.userId, eventId);
}

export async function updateEvent(
  ctx: RequestContext,
  eventId: string,
  input: unknown,
): Promise<UpdateEventResult> {
  return ctx.supabase
    ? updateEventSupabase(ctx.supabase, ctx.userId, eventId, input)
    : updateEventMemory(ctx.userId, eventId, input);
}

export async function deleteEvent(
  ctx: RequestContext,
  eventId: string,
): Promise<boolean> {
  return ctx.supabase
    ? deleteEventSupabase(ctx.supabase, ctx.userId, eventId)
    : deleteEventMemory(ctx.userId, eventId);
}

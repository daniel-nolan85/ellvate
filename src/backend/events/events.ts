import type { StoredEvent, StoredUser } from '@/src/backend/store';
import { getState, setState } from '@/src/backend/store';

import type {
  CommunityEvent,
  EventsView,
  JoinResult,
  PersonRef,
} from './types';

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
    return user ? [{ id: user.id, name: user.name }] : [];
  });

const toCommunityEvent = (
  event: StoredEvent,
  userId: string,
  users: readonly StoredUser[],
): CommunityEvent => ({
  id: event.id,
  startsAt: event.startsAt,
  timeLabel: event.timeLabel,
  dayLabel: event.dayLabel,
  dateLabel: event.dateLabel,
  title: event.title,
  place: event.place,
  tag: event.tag,
  featured: event.featured,
  going: event.going,
  joined: event.joinedBy.includes(userId),
  attendees: toPersonRefs(event.attendeeIds, users),
});

export function getEventsView(userId: string): EventsView {
  const { events, users, week } = getState();

  return {
    week: week.map((day) => ({ ...day })),
    events: [...events]
      .sort(byFeaturedThenStartsAt)
      .map((event) => toCommunityEvent(event, userId, users)),
  };
}

export function toggleJoin(userId: string, eventId: string): JoinResult | null {
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

  return updated
    ? { id: updated.id, going: updated.going, joined }
    : null;
}

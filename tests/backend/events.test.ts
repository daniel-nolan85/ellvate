import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getEvents, POST as postEvent } from '../../app/api/events+api';
import {
  DELETE as deleteEventRoute,
  PATCH as patchEventRoute,
} from '../../app/api/events/[id]/index+api';
import { POST as postJoin } from '../../app/api/events/[id]/join+api';
import { createEventComment, listEventComments } from '../../src/backend/event-comments';
import {
  createEvent,
  deleteEvent,
  getEventsView,
  toggleJoin,
  updateEvent,
} from '../../src/backend/events';
import { memoryContext } from '../../src/backend/http';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('getEventsView', () => {
  test('returns featured events first, then upcoming by startsAt', async () => {
    const { events } = await getEventsView(ctx());

    expect(events.map((event) => event.id)).toEqual([
      'event-1',
      'event-2',
      'event-3',
      'event-4',
    ]);
    expect(events[0]?.featured).toBe(true);

    const rest = events.slice(1);
    expect(rest.every((event) => !event.featured)).toBe(true);
    expect(rest.map((event) => Date.parse(event.startsAt))).toEqual(
      rest.map((event) => Date.parse(event.startsAt)).toSorted((a, b) => a - b),
    );
  });

  test('week strip has 7 days with isToday exactly once', async () => {
    const { week } = await getEventsView(ctx());

    expect(week).toHaveLength(7);
    expect(week.filter((day) => day.isToday)).toHaveLength(1);
    expect(week.find((day) => day.isToday)?.dayLabel).toBe('FRI');
  });

  test('maps attendees to PersonRef with id and name only', async () => {
    const { events } = await getEventsView(ctx());
    const featured = events[0];

    expect(featured?.attendees).toEqual([
      { avatarUrl: null, id: 'user-riley', name: 'Riley Kim' },
      { avatarUrl: null, id: 'user-mia', name: 'Mia Lake' },
      { avatarUrl: null, id: 'user-jordan', name: 'Jordan Diaz' },
      { avatarUrl: null, id: 'user-andre', name: 'Andre King' },
    ]);
  });

  test('derives joined per requesting user', async () => {
    expect(
      (await getEventsView(ctx())).events.every((event) => !event.joined),
    ).toBe(true);

    await toggleJoin(ctx(), 'event-2');

    const forMe = (await getEventsView(ctx())).events.find(
      (event) => event.id === 'event-2',
    );
    const forOther = (await getEventsView(ctx('user-mia'))).events.find(
      (event) => event.id === 'event-2',
    );

    expect(forMe?.joined).toBe(true);
    expect(forOther?.joined).toBe(false);
  });
});

describe('toggleJoin', () => {
  test('joining increments going and marks joined', async () => {
    const result = await toggleJoin(ctx(), 'event-1');

    expect(result).toEqual({ id: 'event-1', going: 49, joined: true });
  });

  test('toggling again decrements going back and clears joined', async () => {
    await toggleJoin(ctx(), 'event-1');
    const result = await toggleJoin(ctx(), 'event-1');

    expect(result).toEqual({ id: 'event-1', going: 48, joined: false });
  });

  test('does not mutate the previous stored event object', async () => {
    const before = getState().events.find((event) => event.id === 'event-1');

    await toggleJoin(ctx(), 'event-1');

    expect(before?.going).toBe(48);
    expect(before?.joinedBy).toEqual([]);
  });

  test('returns null for an unknown event', async () => {
    expect(await toggleJoin(ctx(), 'event-999')).toBeNull();
  });
});

describe('createEvent', () => {
  const validInput = {
    date: '2026-07-18',
    place: 'Village Marina',
    tag: 'Outdoors',
    time: '18:00',
    title: 'Sunset Kayak',
  };

  test('creates an event with derived labels and lists it', async () => {
    const result = await createEvent(ctx(), validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.event).toMatchObject({
      title: 'Sunset Kayak',
      place: 'Village Marina',
      tag: 'Outdoors',
      timeLabel: '6:00 PM',
      dayLabel: 'SAT',
      dateLabel: '18',
      going: 0,
      joined: false,
      featured: false,
    });

    const listed = (await getEventsView(ctx())).events.find(
      (event) => event.id === result.event.id,
    );
    expect(listed).toBeDefined();
  });

  test('rejects a missing title', async () => {
    const result = await createEvent(ctx(), { ...validInput, title: '' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_event' });
  });

  test('rejects a malformed day', async () => {
    const result = await createEvent(ctx(), { ...validInput, date: 'nope' });

    expect(result).toMatchObject({ ok: false, code: 'invalid_event' });
  });

  test('rejects a calendar date that JavaScript would normalize', async () => {
    const result = await createEvent(ctx(), {
      ...validInput,
      date: '2026-02-31',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_event' });
  });

  test('stores uploaded images as event media', async () => {
    const result = await createEvent(ctx(), {
      ...validInput,
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'kayak-1.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.media).toEqual([
        { filename: 'kayak-1.jpg', url: 'data:image/jpeg;base64,b25l' },
      ]);
    }
  });

  test('an event with no images has undefined media', async () => {
    const result = await createEvent(ctx(), validInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.media).toBeUndefined();
    }
  });
});

describe('POST /api/events', () => {
  const postEventRequest = (body: unknown) =>
    postEvent(
      new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  test('creates an event and returns 201', async () => {
    const response = await postEventRequest({
      date: '2026-07-19',
      place: 'The Village',
      tag: 'Market',
      time: '10:00',
      title: 'Market Day',
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      event: { title: string; dayLabel: string; timeLabel: string };
    };
    expect(body.event).toMatchObject({
      title: 'Market Day',
      dayLabel: 'SUN',
      timeLabel: '10:00 AM',
    });
  });

  test('400s with the ApiError envelope on invalid input', async () => {
    const response = await postEventRequest({ title: '' });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_event');
  });
});

describe('GET /api/events', () => {
  test('returns the { week, events } view', async () => {
    const response = await getEvents(new Request('http://localhost/api/events'));
    const body = (await response.json()) as {
      week: readonly { isToday: boolean }[];
      events: readonly { id: string; featured: boolean; joined: boolean }[];
    };

    expect(response.status).toBe(200);
    expect(body.week).toHaveLength(7);
    expect(body.events).toHaveLength(4);
    expect(body.events[0]).toMatchObject({ id: 'event-1', featured: true });
  });
});

describe('updateEvent', () => {
  const editInput = {
    date: '2026-07-25',
    place: 'New Marina Deck',
    tag: 'Community',
    time: '19:00',
    title: 'Updated Mixer',
  };

  test('the author can edit their own event', async () => {
    const result = await updateEvent(ctx('user-hoa'), 'event-1', editInput);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.event).toMatchObject({
      title: 'Updated Mixer',
      place: 'New Marina Deck',
      tag: 'Community',
      timeLabel: '7:00 PM',
    });
  });

  test('rejects edits from a user who does not own the event', async () => {
    const result = await updateEvent(ctx(DEMO_USER_ID), 'event-1', editInput);

    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('returns not_found for an unknown event', async () => {
    const result = await updateEvent(ctx('user-hoa'), 'event-999', editInput);

    expect(result).toMatchObject({ ok: false, code: 'event_not_found' });
  });

  test('rejects invalid input', async () => {
    const result = await updateEvent(ctx('user-hoa'), 'event-1', {
      ...editInput,
      title: '',
    });

    expect(result).toMatchObject({ ok: false, code: 'invalid_event' });
  });

  test('keeps existing media while adding new uploads', async () => {
    const created = await createEvent(ctx(), {
      date: '2026-07-18',
      place: 'Village Marina',
      tag: 'Outdoors',
      time: '18:00',
      title: 'Sunset Kayak',
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'one.jpg' },
      ],
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updateEvent(ctx(), created.event.id, {
      ...editInput,
      existingMedia: [
        { filename: 'one.jpg', url: 'data:image/jpeg;base64,b25l' },
      ],
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,dHdv', filename: 'two.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.media).toEqual([
        { filename: 'one.jpg', url: 'data:image/jpeg;base64,b25l' },
        { filename: 'two.jpg', url: 'data:image/jpeg;base64,dHdv' },
      ]);
    }
  });

  test('removes all media when the client omits existingMedia and newMedia', async () => {
    const created = await createEvent(ctx(), {
      date: '2026-07-18',
      place: 'Village Marina',
      tag: 'Outdoors',
      time: '18:00',
      title: 'Sunset Kayak',
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'one.jpg' },
      ],
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updateEvent(ctx(), created.event.id, editInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.media).toBeUndefined();
    }
  });
});

describe('deleteEvent', () => {
  test('the author can cancel their own event', async () => {
    expect(await deleteEvent(ctx('user-hoa'), 'event-1')).toBe(true);
    expect(
      (await getEventsView(ctx())).events.some((event) => event.id === 'event-1'),
    ).toBe(false);
  });

  test('returns false for a user who does not own the event', async () => {
    expect(await deleteEvent(ctx(DEMO_USER_ID), 'event-1')).toBe(false);
    expect(
      (await getEventsView(ctx())).events.some((event) => event.id === 'event-1'),
    ).toBe(true);
  });

  test('returns false for an unknown event', async () => {
    expect(await deleteEvent(ctx('user-hoa'), 'event-999')).toBe(false);
  });

  test('removes the event\'s comments so they are no longer listable', async () => {
    const created = await createEventComment(ctx('user-riley'), 'event-1', {
      body: 'Cannot wait!',
    });
    expect(created.ok).toBe(true);

    expect(await deleteEvent(ctx('user-hoa'), 'event-1')).toBe(true);
    expect(await listEventComments(ctx(), 'event-1')).toEqual([]);
    expect(
      getState().eventComments.some((comment) => comment.eventId === 'event-1'),
    ).toBe(false);
  });
});

describe('PATCH /api/events/:id', () => {
  const patchEventRequest = (id: string, body: unknown) =>
    patchEventRoute(
      new Request(`http://localhost/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { id },
    );

  test('updates an event owned by the demo user and returns 200', async () => {
    const created = await createEvent(ctx(), {
      date: '2026-07-19',
      place: 'The Village',
      tag: 'Market',
      time: '10:00',
      title: 'Market Day',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const response = await patchEventRequest(created.event.id, {
      date: '2026-07-25',
      place: 'New Marina Deck',
      tag: 'Community',
      time: '19:00',
      title: 'Updated Mixer',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      event: { title: string; place: string };
    };
    expect(body.event).toMatchObject({
      title: 'Updated Mixer',
      place: 'New Marina Deck',
    });
  });

  test('returns 403 when editing someone else’s event', async () => {
    const response = await patchEventRequest('event-1', {
      date: '2026-07-25',
      place: 'New Marina Deck',
      tag: 'Community',
      time: '19:00',
      title: 'Hijack',
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 'forbidden',
      message: 'You can only edit your own events.',
    });
  });

  test('returns 404 for an unknown event', async () => {
    const response = await patchEventRequest('event-999', {
      date: '2026-07-25',
      place: 'New Marina Deck',
      tag: 'Community',
      time: '19:00',
      title: 'Updated Mixer',
    });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/events/:id', () => {
  test('cancels an event owned by the demo user and returns 200', async () => {
    const created = await createEvent(ctx(), {
      date: '2026-07-19',
      place: 'The Village',
      tag: 'Market',
      time: '10:00',
      title: 'Market Day',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const response = await deleteEventRoute(
      new Request(`http://localhost/api/events/${created.event.id}`, {
        method: 'DELETE',
      }),
      { id: created.event.id },
    );

    expect(response.status).toBe(200);
  });

  test('returns 404 when deleting someone else’s event', async () => {
    const response = await deleteEventRoute(
      new Request('http://localhost/api/events/event-1', { method: 'DELETE' }),
      { id: 'event-1' },
    );

    expect(response.status).toBe(404);
  });

  test('404s for an unknown event', async () => {
    const response = await deleteEventRoute(
      new Request('http://localhost/api/events/event-999', {
        method: 'DELETE',
      }),
      { id: 'event-999' },
    );

    expect(response.status).toBe(404);
  });
});

describe('POST /api/events/:id/join', () => {
  test('toggles join for the demo user', async () => {
    const response = await postJoin(
      new Request('http://localhost/api/events/event-3/join', {
        method: 'POST',
      }),
      { id: 'event-3' },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'event-3',
      going: 33,
      joined: true,
    });
  });

  test('returns 404 with the ApiError envelope for an unknown event', async () => {
    const response = await postJoin(
      new Request('http://localhost/api/events/nope/join', { method: 'POST' }),
      { id: 'nope' },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 'event_not_found',
      message: 'Event not found.',
    });
  });
});

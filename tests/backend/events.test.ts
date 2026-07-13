import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getEvents } from '../../app/api/events+api';
import { POST as postJoin } from '../../app/api/events/[id]/join+api';
import { getEventsView, toggleJoin } from '../../src/backend/events';
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
      { id: 'user-riley', name: 'Riley Kim' },
      { id: 'user-mia', name: 'Mia Lake' },
      { id: 'user-jordan', name: 'Jordan Diaz' },
      { id: 'user-andre', name: 'Andre King' },
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

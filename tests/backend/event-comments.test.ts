import { afterEach, describe, expect, test } from 'bun:test';

import { DELETE as deleteRoute } from '../../app/api/event-comments/[id]/index+api';
import { POST as reportRoute } from '../../app/api/event-comments/[id]/report+api';
import {
  GET as getEventComments,
  POST as postEventComment,
} from '../../app/api/events/[id]/comments+api';
import {
  createEventComment,
  deleteEventComment,
  listEventComments,
  reportEventComment,
} from '../../src/backend/event-comments';
import { memoryContext } from '../../src/backend/http';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('listEventComments', () => {
  test('returns an empty list for an event with no comments', async () => {
    expect(await listEventComments(ctx(), 'event-1')).toEqual([]);
  });

  test('returns comments oldest-first', async () => {
    await createEventComment(ctx(), 'event-1', { body: 'first' });
    await createEventComment(ctx('user-mia'), 'event-1', { body: 'second' });

    const comments = await listEventComments(ctx(), 'event-1');
    expect(comments.map((comment) => comment.body)).toEqual(['first', 'second']);
    expect(comments[1]?.author).toEqual({
      avatarUrl: null,
      id: 'user-mia',
      name: 'Mia Lake',
    });
  });
});

describe('createEventComment', () => {
  test('rejects an empty body', async () => {
    expect(
      await createEventComment(ctx(), 'event-1', { body: '  ' }),
    ).toMatchObject({ ok: false, code: 'invalid_comment' });
  });

  test('rejects a non-object body', async () => {
    expect(await createEventComment(ctx(), 'event-1', null)).toMatchObject({
      ok: false,
      code: 'invalid_comment',
    });
  });

  test('rejects a comment on an unknown event', async () => {
    expect(
      await createEventComment(ctx(), 'event-nope', { body: 'hi' }),
    ).toMatchObject({ ok: false, code: 'event_not_found' });
  });

  test('creates a comment attributed to the acting user', async () => {
    const result = await createEventComment(ctx(), 'event-1', {
      body: ' See you there! ',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.comment).toMatchObject({
      eventId: 'event-1',
      author: { id: DEMO_USER_ID, name: 'You' },
      body: 'See you there!',
    });
  });
});

describe('deleteEventComment', () => {
  test('deletes only the author’s own comment', async () => {
    const created = await createEventComment(ctx(), 'event-1', { body: 'mine' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    expect(
      await deleteEventComment(ctx('user-mia'), created.comment.id),
    ).toBe(false);
    expect(await deleteEventComment(ctx(), created.comment.id)).toBe(true);
    expect(await listEventComments(ctx(), 'event-1')).toEqual([]);
  });

  test('returns false for an unknown comment', async () => {
    expect(await deleteEventComment(ctx(), 'event-comment-nope')).toBe(false);
  });
});

describe('reportEventComment', () => {
  test('reports an existing comment', async () => {
    const created = await createEventComment(ctx(), 'event-1', { body: 'mine' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await reportEventComment(ctx('user-mia'), created.comment.id);

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().eventCommentReports.some(
        (report) =>
          report.eventCommentId === created.comment.id &&
          report.reporterId === 'user-mia',
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same comment twice records one report', async () => {
    const created = await createEventComment(ctx(), 'event-1', { body: 'mine' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    await reportEventComment(ctx('user-mia'), created.comment.id);
    await reportEventComment(ctx('user-mia'), created.comment.id);

    expect(
      getState().eventCommentReports.filter(
        (report) =>
          report.eventCommentId === created.comment.id &&
          report.reporterId === 'user-mia',
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown comment', async () => {
    const result = await reportEventComment(ctx(), 'event-comment-nope');

    expect(result).toMatchObject({ ok: false, code: 'event_comment_not_found' });
  });
});

describe('event comment routes', () => {
  test('GET returns { comments }; POST creates 201; DELETE removes', async () => {
    const created = await postEventComment(
      new Request('http://localhost/api/events/event-2/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Looking forward to it' }),
      }),
      { id: 'event-2' },
    );
    expect(created.status).toBe(201);
    const { comment } = (await created.json()) as { comment: { id: string } };

    const listed = await getEventComments(
      new Request('http://localhost/api/events/event-2/comments'),
      { id: 'event-2' },
    );
    const { comments } = (await listed.json()) as {
      comments: readonly { id: string }[];
    };
    expect(comments[comments.length - 1]?.id).toBe(comment.id);

    const reported = await reportRoute(
      new Request(`http://localhost/api/event-comments/${comment.id}/report`, {
        method: 'POST',
      }),
      { id: comment.id },
    );
    expect(reported.status).toBe(200);

    const removed = await deleteRoute(
      new Request(`http://localhost/api/event-comments/${comment.id}`, {
        method: 'DELETE',
      }),
      { id: comment.id },
    );
    expect(removed.status).toBe(200);
  });

  test('POST returns 404 for an unknown event', async () => {
    const response = await postEventComment(
      new Request('http://localhost/api/events/event-nope/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'hi' }),
      }),
      { id: 'event-nope' },
    );
    expect(response.status).toBe(404);
  });
});

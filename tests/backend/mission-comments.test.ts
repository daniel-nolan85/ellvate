import { afterEach, describe, expect, test } from 'bun:test';

import {
  DELETE as deleteRoute,
  PATCH as patchRoute,
} from '../../app/api/mission-comments/[id]/index+api';
import { POST as reportRoute } from '../../app/api/mission-comments/[id]/report+api';
import {
  GET as getMissionComments,
  POST as postMissionComment,
} from '../../app/api/missions/[id]/comments+api';
import {
  createMissionComment,
  deleteMissionComment,
  listMissionComments,
  listMissionCommentsPage,
  reportMissionComment,
  updateMissionComment,
} from '../../src/backend/mission-comments';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { createMission, deleteMission } from '../../src/backend/missions';
import { toggleMute } from '../../src/backend/mutes';
import {
  DEMO_USER_ID,
  getState,
  resetStore,
  setState,
} from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

describe('listMissionComments', () => {
  test('returns an empty list for a mission with no comments', async () => {
    expect(await listMissionComments(ctx(), 'mission-1')).toEqual([]);
  });

  test('returns comments oldest-first', async () => {
    await createMissionComment(ctx(), 'mission-1', { body: 'first' });
    await createMissionComment(ctx('user-mia'), 'mission-1', { body: 'second' });

    const comments = await listMissionComments(ctx(), 'mission-1');
    expect(comments.map((comment) => comment.body)).toEqual(['first', 'second']);
    expect(comments[1]?.author).toEqual({
      avatarUrl: null,
      id: 'user-mia',
      isAdmin: false,
      name: 'Mia Lake',
    });
  });
});

describe('listMissionCommentsPage', () => {
  test('paginates oldest-first and preserves that order across pages', async () => {
    // Distinct createdAt timestamps (not two real-time creates, which can
    // land in the same millisecond and make ordering depend on the id
    // tiebreak) so ordering is deterministic.
    setState((current) => ({
      ...current,
      missionComments: [
        ...current.missionComments,
        {
          authorId: DEMO_USER_ID,
          body: 'first',
          createdAt: '2026-01-01T00:00:00.000Z',
          editedAt: null,
          id: 'mission-comment-page-1',
          missionId: 'mission-1',
        },
        {
          authorId: 'user-mia',
          body: 'second',
          createdAt: '2026-01-01T00:00:01.000Z',
          editedAt: null,
          id: 'mission-comment-page-2',
          missionId: 'mission-1',
        },
      ],
    }));

    const first = await listMissionCommentsPage(ctx(), 'mission-1', { limit: 1 });
    expect(first.comments.map((comment) => comment.body)).toEqual(['first']);
    expect(first.nextCursor).not.toBeNull();

    const second = await listMissionCommentsPage(ctx(), 'mission-1', {
      cursor: first.nextCursor,
      limit: 1,
    });
    expect(second.comments.map((comment) => comment.body)).toEqual(['second']);
    expect(second.nextCursor).toBeNull();
  });

  test('returns an empty page for a mission with no comments', async () => {
    const page = await listMissionCommentsPage(ctx(), 'mission-1');
    expect(page.comments).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  test('excludes comments from a muted author', async () => {
    await createMissionComment(ctx('user-mia'), 'mission-1', { body: 'muted comment' });
    await toggleMute(ctx(), 'user-mia');

    const page = await listMissionCommentsPage(ctx(), 'mission-1');
    expect(page.comments.map((comment) => comment.body)).not.toContain('muted comment');
  });
});

describe('createMissionComment', () => {
  test('rejects an empty body', async () => {
    expect(
      await createMissionComment(ctx(), 'mission-1', { body: '  ' }),
    ).toMatchObject({ ok: false, code: 'invalid_comment' });
  });

  test('rejects a non-object body', async () => {
    expect(await createMissionComment(ctx(), 'mission-1', null)).toMatchObject({
      ok: false,
      code: 'invalid_comment',
    });
  });

  test('rejects a comment on an unknown mission', async () => {
    expect(
      await createMissionComment(ctx(), 'mission-nope', { body: 'hi' }),
    ).toMatchObject({ ok: false, code: 'mission_not_found' });
  });

  test('creates a comment attributed to the acting user', async () => {
    const result = await createMissionComment(ctx(), 'mission-1', {
      body: ' Great mission! ',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.comment).toMatchObject({
      missionId: 'mission-1',
      author: { id: DEMO_USER_ID, name: 'You' },
      body: 'Great mission!',
    });
  });
});

describe('updateMissionComment', () => {
  test('stamps editedAt on update, unset until then', async () => {
    const created = await createMissionComment(ctx(), 'mission-1', {
      body: 'original',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    expect(created.comment.editedAt).toBeNull();

    const updated = await updateMissionComment(ctx(), created.comment.id, {
      body: 'edited',
    });
    expect(updated).toMatchObject({ ok: true });
    if (!updated.ok) {
      return;
    }
    expect(updated.comment.body).toBe('edited');
    expect(updated.comment.editedAt).not.toBeNull();
  });

  test('rejects editing someone else’s comment', async () => {
    const created = await createMissionComment(ctx(), 'mission-1', {
      body: 'mine',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    expect(
      await updateMissionComment(ctx('user-mia'), created.comment.id, {
        body: 'hijacked',
      }),
    ).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('rejects an unknown comment', async () => {
    expect(
      await updateMissionComment(ctx(), 'mission-comment-nope', { body: 'hi' }),
    ).toMatchObject({ ok: false, code: 'mission_comment_not_found' });
  });
});

describe('deleteMissionComment', () => {
  test('deletes only the author’s own comment', async () => {
    const created = await createMissionComment(ctx(), 'mission-1', { body: 'mine' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    expect(
      await deleteMissionComment(ctx('user-mia'), created.comment.id),
    ).toBe(false);
    expect(await deleteMissionComment(ctx(), created.comment.id)).toBe(true);
    expect(await listMissionComments(ctx(), 'mission-1')).toEqual([]);
  });

  test('returns false for an unknown comment', async () => {
    expect(await deleteMissionComment(ctx(), 'mission-comment-nope')).toBe(false);
  });
});

describe('reportMissionComment', () => {
  test('reports an existing comment', async () => {
    const created = await createMissionComment(ctx(), 'mission-1', { body: 'mine' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await reportMissionComment(ctx('user-mia'), created.comment.id);

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().missionCommentReports.some(
        (report) =>
          report.missionCommentId === created.comment.id &&
          report.reporterId === 'user-mia',
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same comment twice records one report', async () => {
    const created = await createMissionComment(ctx(), 'mission-1', { body: 'mine' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    await reportMissionComment(ctx('user-mia'), created.comment.id);
    await reportMissionComment(ctx('user-mia'), created.comment.id);

    expect(
      getState().missionCommentReports.filter(
        (report) =>
          report.missionCommentId === created.comment.id &&
          report.reporterId === 'user-mia',
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown comment', async () => {
    const result = await reportMissionComment(ctx(), 'mission-comment-nope');

    expect(result).toMatchObject({ ok: false, code: 'mission_comment_not_found' });
  });
});

describe('deleteMission cascade', () => {
  test('removes comments and comment reports belonging to the deleted mission', async () => {
    const created = await createMission(ctx(), {
      description: 'Rent a kayak and get on the water.',
      theme: 'day',
      scheduledFor: '2026-07-18',
      stops: ['Stop 1'],
      title: 'Paddle the Lake',
      xp: 75,
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    const comment = await createMissionComment(ctx('user-mia'), created.mission.id, {
      body: 'Count me in!',
    });
    if (!comment.ok) {
      throw new Error('setup failed');
    }
    await reportMissionComment(ctx('user-andre'), comment.comment.id);

    expect(await deleteMission(ctx(), created.mission.id)).toBe(true);
    expect(await listMissionComments(ctx(), created.mission.id)).toEqual([]);
    expect(
      getState().missionCommentReports.some(
        (report) => report.missionCommentId === comment.comment.id,
      ),
    ).toBe(false);
  });
});

describe('mission comment routes', () => {
  test('GET returns { comments }; POST creates 201; DELETE removes', async () => {
    const created = await postMissionComment(
      new Request('http://localhost/api/missions/mission-2/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Looking forward to it' }),
      }),
      { id: 'mission-2' },
    );
    expect(created.status).toBe(201);
    const { comment } = (await created.json()) as { comment: { id: string } };

    const listed = await getMissionComments(
      new Request('http://localhost/api/missions/mission-2/comments'),
      { id: 'mission-2' },
    );
    const { comments } = (await listed.json()) as {
      comments: readonly { id: string }[];
    };
    expect(comments[comments.length - 1]?.id).toBe(comment.id);

    const reported = await reportRoute(
      new Request(`http://localhost/api/mission-comments/${comment.id}/report`, {
        method: 'POST',
      }),
      { id: comment.id },
    );
    expect(reported.status).toBe(200);

    const patched = await patchRoute(
      new Request(`http://localhost/api/mission-comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Actually, count me in' }),
      }),
      { id: comment.id },
    );
    expect(patched.status).toBe(200);
    const { comment: patchedComment } = (await patched.json()) as {
      comment: { body: string };
    };
    expect(patchedComment.body).toBe('Actually, count me in');

    const removed = await deleteRoute(
      new Request(`http://localhost/api/mission-comments/${comment.id}`, {
        method: 'DELETE',
      }),
      { id: comment.id },
    );
    expect(removed.status).toBe(200);
  });

  test('POST returns 404 for an unknown mission', async () => {
    const response = await postMissionComment(
      new Request('http://localhost/api/missions/mission-nope/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'hi' }),
      }),
      { id: 'mission-nope' },
    );
    expect(response.status).toBe(404);
  });

  test('GET honors ?limit and ?cursor for pagination', async () => {
    // Distinct createdAt timestamps (not two real-time POSTs, which can land
    // in the same millisecond and make ordering depend on the id tiebreak)
    // so ordering is deterministic.
    setState((current) => ({
      ...current,
      missionComments: [
        ...current.missionComments,
        {
          authorId: DEMO_USER_ID,
          body: 'first',
          createdAt: '2026-01-01T00:00:00.000Z',
          editedAt: null,
          id: 'mission-comment-route-1',
          missionId: 'mission-4',
        },
        {
          authorId: 'user-mia',
          body: 'second',
          createdAt: '2026-01-01T00:00:01.000Z',
          editedAt: null,
          id: 'mission-comment-route-2',
          missionId: 'mission-4',
        },
      ],
    }));

    const firstResponse = await getMissionComments(
      new Request('http://localhost/api/missions/mission-4/comments?limit=1'),
      { id: 'mission-4' },
    );
    const first = (await firstResponse.json()) as {
      comments: readonly { body: string }[];
      nextCursor: string | null;
    };
    expect(first.comments.map((comment) => comment.body)).toEqual(['first']);
    expect(first.nextCursor).not.toBeNull();

    const secondResponse = await getMissionComments(
      new Request(
        `http://localhost/api/missions/mission-4/comments?limit=1&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
      ),
      { id: 'mission-4' },
    );
    const second = (await secondResponse.json()) as {
      comments: readonly { body: string }[];
      nextCursor: string | null;
    };
    expect(second.comments.map((comment) => comment.body)).toEqual(['second']);
    expect(second.nextCursor).toBeNull();
  });
});

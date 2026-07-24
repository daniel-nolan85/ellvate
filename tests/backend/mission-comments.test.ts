import { afterEach, describe, expect, test } from 'bun:test';

import { DELETE as deleteRoute } from '../../app/api/mission-comments/[id]/index+api';
import { POST as reportRoute } from '../../app/api/mission-comments/[id]/report+api';
import {
  GET as getMissionComments,
  POST as postMissionComment,
} from '../../app/api/missions/[id]/comments+api';
import {
  createMissionComment,
  deleteMissionComment,
  listMissionComments,
  reportMissionComment,
} from '../../src/backend/mission-comments';
import { memoryContext } from '../../src/backend/http';
import { createMission, deleteMission } from '../../src/backend/missions';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
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
      name: 'Mia Lake',
    });
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
      icon: 'Sun',
      scheduledFor: '2026-07-18',
      stopsTotal: 1,
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
});

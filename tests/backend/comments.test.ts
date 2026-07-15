import { afterEach, describe, expect, test } from 'bun:test';

import { DELETE as deleteRoute } from '../../app/api/comments/[id]+api';
import {
  GET as getComments,
  POST as postComment,
} from '../../app/api/forum/posts/[id]/comments+api';
import {
  createComment,
  deleteComment,
  listComments,
} from '../../src/backend/comments';
import { memoryContext } from '../../src/backend/http';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);
const replyCount = (postId: string): number =>
  getState().posts.find((post) => post.id === postId)?.replies ?? -1;

afterEach(() => {
  resetStore();
});

describe('listComments', () => {
  test('keeps seeded reply counts aligned with renderable comments', () => {
    const state = getState();

    for (const post of state.posts) {
      expect(post.replies).toBe(
        state.comments.filter((comment) => comment.postId === post.id).length,
      );
    }
  });

  test('returns an empty list for a post with no comments', async () => {
    expect(await listComments(ctx(), 'post-without-comments')).toEqual([]);
  });

  test('returns comments oldest-first', async () => {
    const seeded = await listComments(ctx(), 'post-1');
    await createComment(ctx(), 'post-1', { body: 'first' });
    await createComment(ctx('user-mia'), 'post-1', { body: 'second' });

    const comments = await listComments(ctx(), 'post-1');
    expect(comments.slice(seeded.length).map((comment) => comment.body)).toEqual([
      'first',
      'second',
    ]);
    expect(comments[comments.length - 1]?.author).toEqual({
      id: 'user-mia',
      name: 'Mia Lake',
    });
  });
});

describe('createComment', () => {
  test('rejects an empty body', async () => {
    expect(await createComment(ctx(), 'post-1', { body: '  ' })).toMatchObject({
      ok: false,
      code: 'invalid_comment',
    });
  });

  test('rejects a non-object body', async () => {
    expect(await createComment(ctx(), 'post-1', null)).toMatchObject({
      ok: false,
      code: 'invalid_comment',
    });
  });

  test('rejects a comment on an unknown post', async () => {
    expect(
      await createComment(ctx(), 'post-nope', { body: 'hi' }),
    ).toMatchObject({ ok: false, code: 'post_not_found' });
  });

  test('creates a comment and increments the post reply count', async () => {
    const before = replyCount('post-1');
    const result = await createComment(ctx(), 'post-1', { body: ' Nice tip! ' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.comment).toMatchObject({
      postId: 'post-1',
      author: { id: DEMO_USER_ID, name: 'You' },
      body: 'Nice tip!',
    });
    expect(replyCount('post-1')).toBe(before + 1);
  });
});

describe('deleteComment', () => {
  test('deletes only the author own comment and decrements the count', async () => {
    const before = await listComments(ctx(), 'post-1');
    const created = await createComment(ctx(), 'post-1', { body: 'mine' });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    const after = replyCount('post-1');

    expect(await deleteComment(ctx('user-mia'), created.comment.id)).toBe(false);
    expect(await deleteComment(ctx(), created.comment.id)).toBe(true);
    expect(replyCount('post-1')).toBe(after - 1);
    expect(await listComments(ctx(), 'post-1')).toEqual(before);
  });

  test('returns false for an unknown comment', async () => {
    expect(await deleteComment(ctx(), 'comment-nope')).toBe(false);
  });
});

describe('comment routes', () => {
  test('GET returns { comments }; POST creates 201; DELETE removes', async () => {
    const created = await postComment(
      new Request('http://localhost/api/forum/posts/post-2/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Looking forward to it' }),
      }),
      { id: 'post-2' },
    );
    expect(created.status).toBe(201);
    const { comment } = (await created.json()) as { comment: { id: string } };

    const listed = await getComments(
      new Request('http://localhost/api/forum/posts/post-2/comments'),
      { id: 'post-2' },
    );
    const { comments } = (await listed.json()) as {
      comments: readonly { id: string }[];
    };
    expect(comments[comments.length - 1]?.id).toBe(comment.id);

    const removed = await deleteRoute(
      new Request(`http://localhost/api/comments/${comment.id}`, {
        method: 'DELETE',
      }),
      { id: comment.id },
    );
    expect(removed.status).toBe(200);
  });

  test('POST returns 404 for an unknown post', async () => {
    const response = await postComment(
      new Request('http://localhost/api/forum/posts/post-nope/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'hi' }),
      }),
      { id: 'post-nope' },
    );
    expect(response.status).toBe(404);
  });
});

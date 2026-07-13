import { afterEach, describe, expect, test } from 'bun:test';

import { POST as postLike } from '../../app/api/forum/posts/[id]/like+api';
import {
  GET as getPosts,
  POST as postCreate,
} from '../../app/api/forum/posts+api';
import { GET as getSubforums } from '../../app/api/forum/subforums+api';
import {
  createPost,
  listPosts,
  listSubforums,
  toggleLike,
} from '../../src/backend/forum';
import { memoryContext } from '../../src/backend/http';
import { DEMO_USER_ID, getState, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('listSubforums', () => {
  test('returns the seeded subforums starting with All', async () => {
    const subforums = await listSubforums(ctx());

    expect(subforums[0]).toBe('All');
    expect(subforums).toEqual([
      'All',
      'Announcements',
      'Marina & Boating',
      'Dining',
      'Trails',
      'Buy & Sell',
      'Events',
    ]);
  });
});

describe('listPosts', () => {
  test('returns all posts pinned first, then newest', async () => {
    const posts = await listPosts(ctx());

    expect(posts.map((post) => post.id)).toEqual([
      'post-2',
      'post-1',
      'post-3',
      'post-4',
    ]);
    expect(posts[0]?.pinned).toBe(true);
  });

  test('maps StoredPost to the ForumPost contract shape', async () => {
    const post = (await listPosts(ctx())).find((entry) => entry.id === 'post-1');

    const { createdAt, ...rest } = post ?? {};
    expect(rest).toEqual({
      id: 'post-1',
      forum: 'Marina & Boating',
      author: { id: 'user-jordan', name: 'Jordan Diaz' },
      title: 'Best spots to kayak at sunrise?',
      excerpt:
        'New to the lake — where do you all put in before the wind picks up? Looking for calm water near the village.',
      replies: 24,
      likes: 61,
      liked: false,
      pinned: false,
    });
    const createdMs = Date.parse(createdAt as string);
    expect(Number.isNaN(createdMs)).toBe(false);
    expect(createdMs).toBeLessThanOrEqual(Date.now());
  });

  test('filters by forum name', async () => {
    const posts = await listPosts(ctx(), 'Dining');

    expect(posts.map((post) => post.id)).toEqual(['post-3']);
  });

  test('treats All and omitted forum the same', async () => {
    expect(await listPosts(ctx(), 'All')).toEqual(await listPosts(ctx()));
  });

  test('returns an empty list for an unknown forum', async () => {
    expect(await listPosts(ctx(), 'Nope')).toEqual([]);
  });

  test('marks liked=true only for posts the user liked', async () => {
    await toggleLike(ctx(), 'post-3');

    const posts = await listPosts(ctx());
    const other = await listPosts(ctx('user-mia'));

    expect(posts.find((post) => post.id === 'post-3')?.liked).toBe(true);
    expect(posts.find((post) => post.id === 'post-1')?.liked).toBe(false);
    expect(other.find((post) => post.id === 'post-3')?.liked).toBe(false);
  });
});

describe('createPost', () => {
  test('rejects an empty or missing title', async () => {
    const missing = await createPost(ctx(), { forum: 'Dining' });
    const blank = await createPost(ctx(), { forum: 'Dining', title: '   ' });

    expect(missing).toMatchObject({ ok: false, code: 'invalid_post' });
    expect(blank).toMatchObject({ ok: false, code: 'invalid_post' });
    expect(getState().posts).toHaveLength(4);
  });

  test('rejects an empty or missing forum', async () => {
    const missing = await createPost(ctx(), { title: 'Hello lake' });
    const blank = await createPost(ctx(), { forum: '', title: 'Hello lake' });

    expect(missing).toMatchObject({ ok: false, code: 'invalid_post' });
    expect(blank).toMatchObject({ ok: false, code: 'invalid_post' });
  });

  test('rejects a non-object body', async () => {
    expect(await createPost(ctx(), null)).toMatchObject({
      ok: false,
      code: 'invalid_post',
    });
  });

  test('rejects an unknown forum', async () => {
    expect(await createPost(ctx(), { forum: 'Nope', title: 'Hi' })).toMatchObject({
      ok: false,
      code: 'invalid_post',
    });
  });

  test('creates a post authored by the seed person for the user', async () => {
    const result = await createPost(ctx(), {
      forum: ' Dining ',
      title: ' Taco night? ',
      excerpt: ' Anyone in? ',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.post).toMatchObject({
      forum: 'Dining',
      author: { id: DEMO_USER_ID, name: 'You' },
      title: 'Taco night?',
      excerpt: 'Anyone in?',
      replies: 0,
      likes: 0,
      liked: false,
      pinned: false,
    });
    expect(Number.isNaN(Date.parse(result.post.createdAt))).toBe(false);
    expect(getState().posts).toHaveLength(5);
  });

  test('created post lists first in its forum', async () => {
    const result = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Best brunch spot',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect((await listPosts(ctx(), 'Dining'))[0]?.id).toBe(result.post.id);
  });
});

describe('toggleLike', () => {
  test('likes then unlikes a post', async () => {
    const liked = await toggleLike(ctx(), 'post-1');
    expect(liked).toEqual({ id: 'post-1', likes: 62, liked: true });

    const unliked = await toggleLike(ctx(), 'post-1');
    expect(unliked).toEqual({ id: 'post-1', likes: 61, liked: false });
  });

  test('tracks likes per user independently', async () => {
    await toggleLike(ctx(), 'post-4');
    const second = await toggleLike(ctx('user-mia'), 'post-4');

    expect(second).toEqual({ id: 'post-4', likes: 29, liked: true });
  });

  test('returns null for an unknown post', async () => {
    expect(await toggleLike(ctx(), 'post-nope')).toBeNull();
  });
});

describe('GET /api/forum/subforums', () => {
  test('returns { subforums } starting with All', async () => {
    const response = await getSubforums(
      new Request('http://localhost/api/forum/subforums'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { subforums: string[] };
    expect(body.subforums[0]).toBe('All');
    expect(body.subforums).toHaveLength(7);
  });
});

describe('GET /api/forum/posts', () => {
  test('returns all posts pinned first without a forum param', async () => {
    const response = await getPosts(
      new Request('http://localhost/api/forum/posts'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      posts: readonly { id: string }[];
    };
    expect(body.posts.map((post) => post.id)).toEqual([
      'post-2',
      'post-1',
      'post-3',
      'post-4',
    ]);
  });

  test('filters with ?forum=', async () => {
    const response = await getPosts(
      new Request('http://localhost/api/forum/posts?forum=Trails'),
    );

    const body = (await response.json()) as {
      posts: readonly { id: string }[];
    };
    expect(body.posts.map((post) => post.id)).toEqual(['post-4']);
  });
});

describe('POST /api/forum/posts', () => {
  test('creates a post and returns 201 with { post }', async () => {
    const response = await postCreate(
      new Request('http://localhost/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forum: 'Buy & Sell',
          title: 'Kayak for sale',
          excerpt: 'Lightly used, village pickup.',
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      post: { author: unknown; forum: string; title: string };
    };
    expect(body.post).toMatchObject({
      forum: 'Buy & Sell',
      title: 'Kayak for sale',
      author: { id: DEMO_USER_ID, name: 'You' },
    });
  });

  test('returns a 400 ApiError envelope for an invalid body', async () => {
    const response = await postCreate(
      new Request('http://localhost/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forum: 'Dining', title: '' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: 'invalid_post',
      message: 'A non-empty forum and title are required.',
    });
  });

  test('returns 400 for a malformed JSON body', async () => {
    const response = await postCreate(
      new Request('http://localhost/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe('POST /api/forum/posts/:id/like', () => {
  test('toggles the like and returns { id, likes, liked }', async () => {
    const request = (): Request =>
      new Request('http://localhost/api/forum/posts/post-2/like', {
        method: 'POST',
      });

    const likeResponse = await postLike(request(), { id: 'post-2' });
    expect(likeResponse.status).toBe(200);
    expect(await likeResponse.json()).toEqual({
      id: 'post-2',
      likes: 139,
      liked: true,
    });

    const unlikeResponse = await postLike(request(), { id: 'post-2' });
    expect(await unlikeResponse.json()).toEqual({
      id: 'post-2',
      likes: 138,
      liked: false,
    });
  });

  test('returns a 404 ApiError envelope for an unknown post', async () => {
    const response = await postLike(
      new Request('http://localhost/api/forum/posts/post-nope/like', {
        method: 'POST',
      }),
      { id: 'post-nope' },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 'post_not_found',
      message: 'Post not found.',
    });
  });
});

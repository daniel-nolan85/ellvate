import { afterEach, describe, expect, test } from 'bun:test';

import {
  GET as getPosts,
  POST as postCreate,
} from '../../app/api/forum/posts+api';
import {
  DELETE as deletePostRoute,
  PATCH as patchPost,
} from '../../app/api/forum/posts/[id]/index+api';
import { POST as postLike } from '../../app/api/forum/posts/[id]/like+api';
import { POST as postPin } from '../../app/api/forum/posts/[id]/pin+api';
import { GET as getSubforums } from '../../app/api/forum/subforums+api';
import {
  createPost,
  deletePost,
  listPosts,
  listSubforums,
  toggleLike,
  togglePin,
  updatePost,
} from '../../src/backend/forum';
import { listComments } from '../../src/backend/comments';
import { memoryContext } from '../../src/backend/http';
import { getMutedUserIds, toggleMute } from '../../src/backend/mutes';
import { updateProfile } from '../../src/backend/profile';
import { reportPost } from '../../src/backend/reports';
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
      'HOA',
      'Marina & Boating',
      'Dining',
      'Trails',
      'Golf',
      'Sports Club',
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
    const post = (await listPosts(ctx())).find(
      (entry) => entry.id === 'post-1',
    );

    const { createdAt, ...rest } = post ?? {};
    expect(rest).toEqual({
      id: 'post-1',
      forum: 'Marina & Boating',
      author: { avatarUrl: null, id: 'user-jordan', name: 'Jordan Diaz' },
      editedAt: null,
      title: 'Best spots to kayak at sunrise?',
      excerpt:
        'New to the lake — where do you all put in before the wind picks up? Looking for calm water near the village.',
      media: undefined,
      replies: 2,
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
    expect(
      await createPost(ctx(), { forum: 'Nope', title: 'Hi' }),
    ).toMatchObject({
      ok: false,
      code: 'invalid_post',
    });
  });

  test('reflects the author’s current avatar on their posts', async () => {
    await updateProfile(ctx(), {
      avatar: { dataUrl: 'data:image/jpeg;base64,ZmFrZQ==', filename: 'me.jpg' },
    });
    const result = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Taco night?',
      excerpt: 'Anyone in?',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.post.author.avatarUrl).toBe('data:image/jpeg;base64,ZmFrZQ==');
    }
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

  test('stores uploaded images as post media', async () => {
    const result = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Waterfront patio',
      excerpt: 'New seating!',
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,Zmly', filename: 'patio-1.jpg' },
        { dataUrl: 'data:image/jpeg;base64,c2Vj', filename: 'patio-2.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.post.media).toEqual([
      { filename: 'patio-1.jpg', url: 'data:image/jpeg;base64,Zmly' },
      { filename: 'patio-2.jpg', url: 'data:image/jpeg;base64,c2Vj' },
    ]);
  });

  test('a post with no images has undefined media', async () => {
    const result = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Text only',
      excerpt: 'No photos here',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.post.media).toBeUndefined();
    }
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

describe('deletePost', () => {
  test('deletes only the author’s own post', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Delete me',
      excerpt: 'Temporary',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    expect(await deletePost(ctx('user-mia'), created.post.id)).toBe(false);
    expect(await deletePost(ctx(), created.post.id)).toBe(true);
    expect(getState().posts.some((post) => post.id === created.post.id)).toBe(
      false,
    );
  });

  test('returns false for an unknown post', async () => {
    expect(await deletePost(ctx(), 'post-nope')).toBe(false);
  });

  test('returns false when the post belongs to someone else', async () => {
    expect(await deletePost(ctx(), 'post-1')).toBe(false);
    expect(getState().posts.some((post) => post.id === 'post-1')).toBe(true);
  });

  test('removes the post’s comments so they are no longer listable', async () => {
    const seededComments = await listComments(ctx(), 'post-1');
    expect(seededComments.length).toBeGreaterThan(0);

    expect(await deletePost(ctx('user-jordan'), 'post-1')).toBe(true);

    expect(await listComments(ctx(), 'post-1')).toEqual([]);
    expect(
      getState().comments.some((comment) => comment.postId === 'post-1'),
    ).toBe(false);
  });
});

describe('updatePost', () => {
  test('updates title and excerpt for the post author', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Original title',
      excerpt: 'Original excerpt',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updatePost(ctx(), created.post.id, {
      title: ' Updated title ',
      excerpt: ' Updated excerpt ',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.post).toMatchObject({
      id: created.post.id,
      title: 'Updated title',
      excerpt: 'Updated excerpt',
      forum: 'Dining',
    });
  });

  test('stamps editedAt on update, unset until then', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Original title',
      excerpt: 'Original excerpt',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    expect(created.post.editedAt).toBeNull();

    const result = await updatePost(ctx(), created.post.id, {
      title: 'Updated title',
      excerpt: 'Updated excerpt',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.post.editedAt).not.toBeNull();
  });

  test('rejects a missing title', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Keep me',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updatePost(ctx(), created.post.id, {
      excerpt: 'x',
      title: '',
    });
    expect(result).toMatchObject({ ok: false, code: 'invalid_post' });
  });

  test('returns post_not_found for an unknown post', async () => {
    const result = await updatePost(ctx(), 'post-nope', {
      excerpt: 'x',
      title: 'Hi',
    });
    expect(result).toMatchObject({ ok: false, code: 'post_not_found' });
  });

  test('returns forbidden when editing someone else’s post', async () => {
    const result = await updatePost(ctx(), 'post-1', {
      excerpt: 'x',
      title: 'Hijack',
    });
    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  test('does not mutate the post on a forbidden update', async () => {
    await updatePost(ctx(), 'post-1', { excerpt: 'x', title: 'Hijack' });
    const post = getState().posts.find((entry) => entry.id === 'post-1');
    expect(post?.title).toBe('Best spots to kayak at sunrise?');
  });

  test('adds newly uploaded images to a post with no existing media', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Original',
      excerpt: 'Body',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updatePost(ctx(), created.post.id, {
      title: 'Original',
      excerpt: 'Body',
      newMedia: [{ dataUrl: 'data:image/jpeg;base64,YWJj', filename: 'new.jpg' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.post.media).toEqual([
        { filename: 'new.jpg', url: 'data:image/jpeg;base64,YWJj' },
      ]);
    }
  });

  test('keeps existing media the client sends back while adding new uploads', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Original',
      excerpt: 'Body',
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,b25l', filename: 'one.jpg' },
        { dataUrl: 'data:image/jpeg;base64,dHdv', filename: 'two.jpg' },
      ],
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updatePost(ctx(), created.post.id, {
      title: 'Original',
      excerpt: 'Body',
      existingMedia: [
        { filename: 'one.jpg', url: 'data:image/jpeg;base64,b25l' },
      ],
      newMedia: [
        { dataUrl: 'data:image/jpeg;base64,dGhyZWU=', filename: 'three.jpg' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.post.media).toEqual([
        { filename: 'one.jpg', url: 'data:image/jpeg;base64,b25l' },
        { filename: 'three.jpg', url: 'data:image/jpeg;base64,dGhyZWU=' },
      ]);
    }
  });

  test('removes all media when the client omits existingMedia and newMedia', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Original',
      excerpt: 'Body',
      newMedia: [{ dataUrl: 'data:image/jpeg;base64,b25l', filename: 'one.jpg' }],
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const result = await updatePost(ctx(), created.post.id, {
      title: 'Original',
      excerpt: 'Body',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.post.media).toBeUndefined();
    }
  });
});

describe('togglePin', () => {
  test('pins then unpins a post for the caller', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Pin me',
      excerpt: 'Body',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const pinned = await togglePin(ctx(), created.post.id);
    expect(pinned).toMatchObject({ ok: true, pinned: true });

    const unpinned = await togglePin(ctx(), created.post.id);
    expect(unpinned).toMatchObject({ ok: true, pinned: false });
  });

  test('pinning a second post replaces the first, for that user only', async () => {
    await togglePin(ctx(), 'post-1');
    expect(
      (await listPosts(ctx())).find((post) => post.id === 'post-1')?.pinned,
    ).toBe(true);

    await togglePin(ctx(), 'post-3');
    const posts = await listPosts(ctx());
    expect(posts.find((post) => post.id === 'post-1')?.pinned).toBe(false);
    expect(posts.find((post) => post.id === 'post-3')?.pinned).toBe(true);
  });

  test('pinning is private — does not show as pinned for a different user', async () => {
    await togglePin(ctx(), 'post-1');

    const mine = await listPosts(ctx());
    const someoneElses = await listPosts(ctx('user-mia'));

    expect(mine.find((post) => post.id === 'post-1')?.pinned).toBe(true);
    expect(someoneElses.find((post) => post.id === 'post-1')?.pinned).toBe(
      false,
    );
  });

  test('lets a non-author pin someone else’s post', async () => {
    const result = await togglePin(ctx('user-mia'), 'post-1');
    expect(result).toMatchObject({ ok: true, pinned: true });
  });

  test('returns post_not_found for an unknown post', async () => {
    const result = await togglePin(ctx(), 'post-nope');
    expect(result).toMatchObject({ ok: false, code: 'post_not_found' });
  });
});

describe('POST /api/forum/posts/:id/pin', () => {
  test('pins a post the caller owns', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Pin me',
      excerpt: 'Body',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const response = await postPin(
      new Request(`http://localhost/api/forum/posts/${created.post.id}/pin`, {
        method: 'POST',
      }),
      { id: created.post.id },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { pinned: boolean };
    expect(body.pinned).toBe(true);
  });

  test('lets a non-author pin someone else’s post via the route', async () => {
    const response = await postPin(
      new Request('http://localhost/api/forum/posts/post-1/pin', {
        method: 'POST',
      }),
      { id: 'post-1' },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { pinned: boolean };
    expect(body.pinned).toBe(true);
  });

  test('returns 404 for an unknown post', async () => {
    const response = await postPin(
      new Request('http://localhost/api/forum/posts/post-nope/pin', {
        method: 'POST',
      }),
      { id: 'post-nope' },
    );
    expect(response.status).toBe(404);
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
    expect(body.subforums).toHaveLength(10);
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

describe('PATCH /api/forum/posts/:id', () => {
  test('updates a post and returns 200 with { post }', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Original',
      excerpt: 'Body',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const response = await patchPost(
      new Request(`http://localhost/api/forum/posts/${created.post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', excerpt: 'New body' }),
      }),
      { id: created.post.id },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      post: { title: string; excerpt: string };
    };
    expect(body.post).toMatchObject({ title: 'Updated', excerpt: 'New body' });
  });

  test('returns 403 when editing someone else’s post', async () => {
    const response = await patchPost(
      new Request('http://localhost/api/forum/posts/post-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hijack', excerpt: 'x' }),
      }),
      { id: 'post-1' },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 'forbidden',
      message: 'You can only edit your own posts.',
    });
  });

  test('returns 404 for an unknown post', async () => {
    const response = await patchPost(
      new Request('http://localhost/api/forum/posts/post-nope', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hi', excerpt: 'x' }),
      }),
      { id: 'post-nope' },
    );

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/forum/posts/:id', () => {
  test('deletes the post and returns { deleted: true, id }', async () => {
    const created = await createPost(ctx(), {
      forum: 'Dining',
      title: 'Bye',
      excerpt: 'x',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    const response = await deletePostRoute(
      new Request(`http://localhost/api/forum/posts/${created.post.id}`, {
        method: 'DELETE',
      }),
      { id: created.post.id },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deleted: true,
      id: created.post.id,
    });
  });

  test('returns a 404 ApiError envelope for an unknown post', async () => {
    const response = await deletePostRoute(
      new Request('http://localhost/api/forum/posts/post-nope', {
        method: 'DELETE',
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

describe('mute this neighbour', () => {
  test('toggling mute hides that author’s posts from the feed', async () => {
    const before = await listPosts(ctx(), 'All');
    expect(before.some((post) => post.author.id === 'user-jordan')).toBe(true);

    const result = await toggleMute(ctx(), 'user-jordan');
    expect(result).toEqual({ muted: true, mutedUserId: 'user-jordan' });

    const after = await listPosts(ctx(), 'All');
    expect(after.some((post) => post.author.id === 'user-jordan')).toBe(false);
  });

  test('toggling mute again unmutes and restores their posts', async () => {
    await toggleMute(ctx(), 'user-jordan');
    const result = await toggleMute(ctx(), 'user-jordan');

    expect(result).toEqual({ muted: false, mutedUserId: 'user-jordan' });
    expect(
      (await listPosts(ctx(), 'All')).some(
        (post) => post.author.id === 'user-jordan',
      ),
    ).toBe(true);
  });

  test('muting only affects the muting user, not other viewers', async () => {
    await toggleMute(ctx(), 'user-jordan');

    expect(await getMutedUserIds(ctx())).toEqual(['user-jordan']);
    expect(await getMutedUserIds(ctx('user-mia'))).toEqual([]);
    expect(
      (await listPosts(ctx('user-mia'), 'All')).some(
        (post) => post.author.id === 'user-jordan',
      ),
    ).toBe(true);
  });
});

describe('report post', () => {
  test('reports an existing post', async () => {
    const result = await reportPost(ctx(), 'post-1');

    expect(result).toEqual({ ok: true, reported: true });
    expect(
      getState().postReports.some(
        (report) =>
          report.postId === 'post-1' && report.reporterId === DEMO_USER_ID,
      ),
    ).toBe(true);
  });

  test('is idempotent — reporting the same post twice records one report', async () => {
    await reportPost(ctx(), 'post-1');
    await reportPost(ctx(), 'post-1');

    expect(
      getState().postReports.filter(
        (report) =>
          report.postId === 'post-1' && report.reporterId === DEMO_USER_ID,
      ),
    ).toHaveLength(1);
  });

  test('rejects reporting an unknown post', async () => {
    const result = await reportPost(ctx(), 'post-nope');

    expect(result).toMatchObject({ ok: false, code: 'post_not_found' });
  });
});

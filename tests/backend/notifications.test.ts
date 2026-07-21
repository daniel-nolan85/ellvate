import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getNotifications } from '../../app/api/notifications+api';
import { PATCH as patchNotification } from '../../app/api/notifications/[id]+api';
import { POST as postReadAll } from '../../app/api/notifications/read-all+api';
import { createComment } from '../../src/backend/comments';
import { createEventComment } from '../../src/backend/event-comments';
import { createPost, toggleLike } from '../../src/backend/forum';
import { memoryContext } from '../../src/backend/http';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../src/backend/notifications';
import { DEMO_USER_ID, resetStore } from '../../src/backend/store';

const ctx = (userId: string = DEMO_USER_ID) => memoryContext(userId);

afterEach(() => {
  resetStore();
});

describe('createComment notifies the post author', () => {
  test('creates a notification when someone else comments on your post', async () => {
    // post-1 is authored by user-jordan (seeded)
    const result = await createComment(ctx('user-mia'), 'post-1', {
      body: 'Nice find!',
    });
    expect(result.ok).toBe(true);

    const notifications = await listNotifications(ctx('user-jordan'));
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'comment',
      title: 'New reply to your post',
      readAt: null,
    });
    expect(notifications[0]?.body).toContain('Mia Lake');
    expect(notifications[0]?.data).toMatchObject({ postId: 'post-1' });
  });

  test('does not notify yourself when you comment on your own post', async () => {
    const result = await createComment(ctx('user-jordan'), 'post-1', {
      body: 'Following up on my own post',
    });
    expect(result.ok).toBe(true);

    expect(await listNotifications(ctx('user-jordan'))).toEqual([]);
  });
});

describe('createEventComment notifies the event author', () => {
  test('creates a notification when someone else comments on your event', async () => {
    // event-1 is authored by user-hoa (seeded)
    const result = await createEventComment(ctx('user-riley'), 'event-1', {
      body: 'See you there!',
    });
    expect(result.ok).toBe(true);

    const notifications = await listNotifications(ctx('user-hoa'));
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'event',
      title: 'New comment on your event',
      readAt: null,
    });
    expect(notifications[0]?.data).toMatchObject({ eventId: 'event-1' });
  });

  test('does not notify yourself when you comment on your own event', async () => {
    const result = await createEventComment(ctx('user-hoa'), 'event-1', {
      body: 'Reminder: bring sunscreen',
    });
    expect(result.ok).toBe(true);

    expect(await listNotifications(ctx('user-hoa'))).toEqual([]);
  });
});

describe('toggleLike notifies the post author', () => {
  test('creates a notification on a new like', async () => {
    // post-1 is authored by user-jordan (seeded)
    const result = await toggleLike(ctx('user-mia'), 'post-1');
    expect(result?.liked).toBe(true);

    const notifications = await listNotifications(ctx('user-jordan'));
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      kind: 'like',
      title: 'New like on your post',
      readAt: null,
    });
    expect(notifications[0]?.body).toContain('Mia Lake');
    expect(notifications[0]?.data).toMatchObject({ postId: 'post-1' });
  });

  test('does not create a notification when unliking', async () => {
    await toggleLike(ctx('user-mia'), 'post-1');
    const unlike = await toggleLike(ctx('user-mia'), 'post-1');
    expect(unlike?.liked).toBe(false);

    expect(await listNotifications(ctx('user-jordan'))).toHaveLength(1);
  });

  test('does not notify yourself when you like your own post', async () => {
    const result = await toggleLike(ctx('user-jordan'), 'post-1');
    expect(result?.liked).toBe(true);

    expect(await listNotifications(ctx('user-jordan'))).toEqual([]);
  });
});

describe('listNotifications', () => {
  test('returns newest first and only the caller\'s own notifications', async () => {
    await createComment(ctx('user-mia'), 'post-1', { body: 'first' });
    await createComment(ctx('user-sam'), 'post-1', { body: 'second' });

    const notifications = await listNotifications(ctx('user-jordan'));
    expect(notifications).toHaveLength(2);
    expect(Date.parse(notifications[0]!.createdAt)).toBeGreaterThanOrEqual(
      Date.parse(notifications[1]!.createdAt),
    );

    expect(await listNotifications(ctx('user-mia'))).toEqual([]);
  });
});

describe('markNotificationRead', () => {
  test('marks the caller\'s own notification as read', async () => {
    await createComment(ctx('user-mia'), 'post-1', { body: 'hey' });
    const [notification] = await listNotifications(ctx('user-jordan'));

    expect(await markNotificationRead(ctx('user-jordan'), notification!.id)).toBe(
      true,
    );
    const [updated] = await listNotifications(ctx('user-jordan'));
    expect(updated?.readAt).not.toBeNull();
  });

  test('returns false for another user\'s notification', async () => {
    await createComment(ctx('user-mia'), 'post-1', { body: 'hey' });
    const [notification] = await listNotifications(ctx('user-jordan'));

    expect(await markNotificationRead(ctx('user-mia'), notification!.id)).toBe(
      false,
    );
  });

  test('returns false for an unknown notification', async () => {
    expect(
      await markNotificationRead(ctx('user-jordan'), 'notification-nope'),
    ).toBe(false);
  });
});

describe('markAllNotificationsRead', () => {
  test('marks every unread notification for the caller and returns the count', async () => {
    await createComment(ctx('user-mia'), 'post-1', { body: 'one' });
    await createComment(ctx('user-sam'), 'post-1', { body: 'two' });

    expect(await markAllNotificationsRead(ctx('user-jordan'))).toBe(2);
    const notifications = await listNotifications(ctx('user-jordan'));
    expect(notifications.every((notification) => notification.readAt !== null)).toBe(
      true,
    );
  });

  test('returns 0 when there is nothing unread', async () => {
    expect(await markAllNotificationsRead(ctx('user-jordan'))).toBe(0);
  });
});

describe('notification routes', () => {
  test('GET returns { notifications }; PATCH marks read; read-all marks the rest', async () => {
    // Unauthenticated route requests default to DEMO_USER_ID (see
    // getRequestUserId), so create a post owned by the demo user and have
    // others comment on it to generate notifications this route call can see.
    const post = await createPost(ctx(DEMO_USER_ID), {
      forum: 'All',
      title: 'My post',
      excerpt: 'Body',
    });
    expect(post.ok).toBe(true);
    if (!post.ok) return;

    await createComment(ctx('user-mia'), post.post.id, { body: 'one' });
    await createComment(ctx('user-sam'), post.post.id, { body: 'two' });

    const listed = await getNotifications(
      new Request('http://localhost/api/notifications'),
    );
    expect(listed.status).toBe(200);
    const { notifications } = (await listed.json()) as {
      notifications: readonly { id: string; readAt: string | null }[];
    };
    expect(notifications).toHaveLength(2);
    expect(notifications.every((notification) => notification.readAt === null)).toBe(
      true,
    );

    const [first, second] = notifications;
    const patched = await patchNotification(
      new Request(`http://localhost/api/notifications/${first!.id}`, {
        method: 'PATCH',
      }),
      { id: first!.id },
    );
    expect(patched.status).toBe(200);

    const readAll = await postReadAll(
      new Request('http://localhost/api/notifications/read-all', {
        method: 'POST',
      }),
    );
    expect(readAll.status).toBe(200);
    const { count } = (await readAll.json()) as { count: number };
    // Only the second notification was still unread.
    expect(count).toBe(1);
    expect(second!.readAt).toBeNull();
  });

  test('PATCH returns 404 for an unknown notification', async () => {
    const response = await patchNotification(
      new Request('http://localhost/api/notifications/notification-nope', {
        method: 'PATCH',
      }),
      { id: 'notification-nope' },
    );
    expect(response.status).toBe(404);
  });
});

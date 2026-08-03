import { afterEach, describe, expect, test } from 'bun:test';

import { GET as getMemberActivityRoute } from '../../app/api/users/[userId]/activity+api';
import { memoryContext } from '../../src/backend/http';
import { updateProfile } from '../../src/backend/profile';
import { DEMO_USER_ID, resetStore } from '../../src/backend/store';

afterEach(() => {
  resetStore();
});

const request = () =>
  new Request('http://localhost/api/users/user-mia/activity');

// Detailed activity is opt-in (defaults to private) — seeded members must
// explicitly share before another user (the DEMO_USER_ID requester baked
// into withRequestContext for these unauthenticated route tests) can view
// their detailed list.
const share = (userId: string) =>
  updateProfile(memoryContext(userId), { activityVisible: true });

describe('GET /api/users/[userId]/activity', () => {
  test('returns a snapshot of the given member’s activity, not the requester’s', async () => {
    await share('user-mia');

    const response = await getMemberActivityRoute(request(), {
      userId: 'user-mia',
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      posts: readonly { id: string }[];
      comments: readonly { id: string }[];
      events: readonly { id: string; author: { id: string } }[];
      missions: readonly { id: string }[];
      services: readonly { id: string }[];
    };

    // Seed: post-3 and event-2 are authored by user-mia; comment-1 is hers.
    expect(body.posts.map((post) => post.id)).toEqual(['post-3']);
    expect(body.comments.map((comment) => comment.id)).toContain('comment-1');
    expect(body.events.map((event) => event.id)).toContain('event-2');
    expect(body.events.every((event) => event.author.id === 'user-mia')).toBe(
      true,
    );
  });

  test('reports missions the member created or completed', async () => {
    // DEMO_USER_ID viewing itself bypasses the sharing check entirely — an
    // owner can always see their own detailed activity.
    const demoResponse = await getMemberActivityRoute(request(), {
      userId: DEMO_USER_ID,
    });
    expect(demoResponse.status).toBe(200);
    const demoBody = (await demoResponse.json()) as {
      missions: readonly { id: string }[];
    };
    expect(demoBody.missions.map((mission) => mission.id)).toEqual([
      'mission-3',
    ]);

    await share('user-hoa');
    const hoaResponse = await getMemberActivityRoute(request(), {
      userId: 'user-hoa',
    });
    expect(hoaResponse.status).toBe(200);
    const hoaBody = (await hoaResponse.json()) as {
      missions: readonly { id: string }[];
    };
    expect(new Set(hoaBody.missions.map((mission) => mission.id))).toEqual(
      new Set(['mission-1', 'mission-2', 'mission-3', 'mission-4']),
    );
  });

  test('reports services the member has listed', async () => {
    await share('user-riley');

    const response = await getMemberActivityRoute(request(), {
      userId: 'user-riley',
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      services: readonly { id: string }[];
    };
    // Seed: service-1 is authored by user-riley.
    expect(body.services.map((service) => service.id)).toEqual(['service-1']);
  });

  test('returns 404 for an unknown member', async () => {
    const response = await getMemberActivityRoute(request(), {
      userId: 'user-does-not-exist',
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('member_not_found');
  });

  test('returns 403 for a member who has not shared their activity', async () => {
    // Seed default: user-mia's profile.activityVisible is false.
    const response = await getMemberActivityRoute(request(), {
      userId: 'user-mia',
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('activity_not_shared');
  });
});

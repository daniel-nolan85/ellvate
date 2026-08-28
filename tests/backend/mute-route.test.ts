import { afterEach, describe, expect, test } from 'bun:test';

import { POST as postMute } from '../../app/api/users/[userId]/mute+api';
import { getMutedUserIds } from '../../src/backend/mutes';
import { memoryContext, resetWriteRateLimits } from '../../src/backend/http';
import { DEMO_USER_ID, resetStore } from '../../src/backend/store';

afterEach(() => {
  resetStore();
  resetWriteRateLimits();
});

describe('POST /api/users/[userId]/mute', () => {
  test('toggles a block on another member', async () => {
    const response = await postMute(new Request('http://test/mute', { method: 'POST' }), {
      userId: 'user-jordan',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { muted: boolean; mutedUserId: string };
    expect(body).toEqual({ muted: true, mutedUserId: 'user-jordan' });
    expect(await getMutedUserIds(memoryContext(DEMO_USER_ID))).toContain('user-jordan');
  });

  // Nothing in the app's UI ever offers a "block yourself" button (every
  // block affordance is gated on author.id !== the viewer), but the route
  // itself is a real, directly-callable endpoint -- this covers the guard
  // that stops a call crafted (or replayed) with your own id from
  // succeeding and silently filtering your own content out of your own feeds.
  test('rejects blocking yourself', async () => {
    const response = await postMute(new Request('http://test/mute', { method: 'POST' }), {
      userId: DEMO_USER_ID,
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('cannot_block_self');
    expect(await getMutedUserIds(memoryContext(DEMO_USER_ID))).not.toContain(DEMO_USER_ID);
  });
});

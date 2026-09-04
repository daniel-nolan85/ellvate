import { describe, expect, test } from 'bun:test';

import { resolveNotificationRoute } from './resolve-notification-route';

describe('resolveNotificationRoute', () => {
  test('routes a comment/like notification to its post modal', () => {
    expect(resolveNotificationRoute({ postId: 'post-1' })).toBe(
      '/notification/post/post-1',
    );
  });

  test('routes an event notification to its event modal', () => {
    expect(resolveNotificationRoute({ eventId: 'evt-1' })).toBe(
      '/notification/event/evt-1',
    );
  });

  test('routes a mission reminder notification to its mission modal', () => {
    expect(resolveNotificationRoute({ missionId: 'msn-1' })).toBe(
      '/notification/mission/msn-1',
    );
  });

  test('routes a petition succeeded/HOA response notification to its petition modal', () => {
    expect(resolveNotificationRoute({ petitionId: 'pet-1' })).toBe(
      '/notification/petition/pet-1',
    );
  });

  test('prefers postId over eventId and missionId when multiple are present', () => {
    expect(
      resolveNotificationRoute({
        eventId: 'evt-1',
        missionId: 'msn-1',
        postId: 'post-1',
      }),
    ).toBe('/notification/post/post-1');
  });

  test('routes a digest notification to the digest screen with its week', () => {
    expect(resolveNotificationRoute({ weekStart: '2026-01-05' })).toBe(
      '/digest?weekStart=2026-01-05',
    );
  });

  test('prefers postId/eventId/missionId over weekStart when both are present', () => {
    expect(
      resolveNotificationRoute({ postId: 'post-1', weekStart: '2026-01-05' }),
    ).toBe('/notification/post/post-1');
  });

  test('returns null when no known id is present', () => {
    expect(resolveNotificationRoute({})).toBeNull();
  });

  test('returns null when ids are present but not strings', () => {
    expect(resolveNotificationRoute({ missionId: 42 })).toBeNull();
  });
});

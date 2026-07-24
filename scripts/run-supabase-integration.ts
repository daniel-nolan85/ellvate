import { strict as assert } from 'node:assert';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { toggleBookmarkSupabase } from '../src/backend/bookmarks/bookmarks-supabase';
import { getMyEventsViewSupabase } from '../src/backend/events/events-supabase';
import { getMyPostsSupabase } from '../src/backend/forum/posts-supabase';
import { getMyMissionsViewSupabase } from '../src/backend/missions/missions-supabase';
import { listNotificationsSupabase } from '../src/backend/notifications/notifications-supabase';

const required = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_TEST_USER_A_ID',
  'SUPABASE_TEST_USER_A_TOKEN',
  'SUPABASE_TEST_USER_B_ID',
  'SUPABASE_TEST_USER_B_TOKEN',
] as const;

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(
    `Supabase integration requires runtime variables: ${missing.join(', ')}`,
  );
  process.exit(1);
}

const value = (name: string): string => {
  const result = process.env[name]?.trim();
  if (!result) throw new Error(`Missing ${name}`);
  return result;
};

const clientFor = (tokenName: 'A' | 'B'): SupabaseClient =>
  createClient(value('SUPABASE_URL'), value('SUPABASE_PUBLISHABLE_KEY'), {
    accessToken: async () => value(`SUPABASE_TEST_USER_${tokenName}_TOKEN`),
  });

const userId = (name: 'A' | 'B'): string =>
  value(`SUPABASE_TEST_USER_${name}_ID`);

const unwrap = async <T>(
  operation: string,
  request: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> => {
  const { data, error } = await request;
  if (error) throw new Error(`${operation}: ${error.message}`);
  return data;
};

const a = clientFor('A');
const b = clientFor('B');
const idA = userId('A');
const idB = userId('B');
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const title = `integration-${suffix}`;
let postId: string | null = null;
let eventId: string | null = null;
let missionId: string | null = null;
let reminderEventId: string | null = null;
let reminderMissionId: string | null = null;
let secondPostId: string | null = null;
let digestPostId: string | null = null;
let digestEventId: string | null = null;
let digestMissionId: string | null = null;

try {
  await unwrap(
    'seed user A',
    a.from('app_users').upsert({ id: idA, name: `Integration A ${suffix}` }),
  );
  await unwrap(
    'seed user B',
    b.from('app_users').upsert({ id: idB, name: `Integration B ${suffix}` }),
  );

  const post = await unwrap(
    'create post as user A',
    a
      .from('posts')
      .insert({
        author_id: idA,
        excerpt: 'RLS integration fixture',
        forum: 'Dining',
        title,
      })
      .select('id')
      .single(),
  );
  assert(post);
  postId = post.id as string;

  const unauthorizedUpdate = await b
    .from('posts')
    .update({ title: `${title}-tampered` })
    .eq('id', postId)
    .select('id');
  assert.equal(unauthorizedUpdate.error, null);
  assert.deepEqual(unauthorizedUpdate.data, []);

  await unwrap(
    'create cross-user comment',
    b
      .from('comments')
      .insert({ author_id: idB, body: 'RLS comment', post_id: postId })
      .select('id')
      .single(),
  );

  const postAfterComment = await unwrap(
    'read reply count',
    a.from('posts').select('reply_count').eq('id', postId).single(),
  );
  assert(postAfterComment);
  assert.equal(postAfterComment.reply_count, 1);

  await unwrap(
    'create own like',
    b.from('post_likes').insert({ post_id: postId, user_id: idB }),
  );
  const likeCount = await unwrap(
    'read like count',
    a.from('posts').select('like_count').eq('id', postId).single(),
  );
  assert(likeCount);
  assert.equal(likeCount.like_count, 1);

  // getMyPostsSupabase: scoped to the caller's own posts (not the whole
  // forum feed) and paginated via a real keyset query, not just RLS.
  const secondPost = await unwrap(
    'create second post as user A',
    a
      .from('posts')
      .insert({
        author_id: idA,
        excerpt: 'second',
        forum: 'Dining',
        title: `${title}-2`,
      })
      .select('id')
      .single(),
  );
  assert(secondPost);
  secondPostId = secondPost.id as string;

  const myPostsFirstPage = await getMyPostsSupabase(a, idA, 1, null);
  assert.equal(myPostsFirstPage.posts.length, 1);
  assert(myPostsFirstPage.nextCursor, 'expected a second page to exist');

  const myPostsSecondPage = await getMyPostsSupabase(
    a,
    idA,
    1,
    myPostsFirstPage.nextCursor,
  );
  assert.equal(myPostsSecondPage.posts.length, 1);
  const myPostIds = new Set(
    [...myPostsFirstPage.posts, ...myPostsSecondPage.posts].map((post) => post.id),
  );
  assert.equal(myPostIds.size, 2);
  assert(myPostIds.has(postId));
  assert(myPostIds.has(secondPostId));

  const bPostsPage = await getMyPostsSupabase(b, idB, 20, null);
  assert.equal(
    bPostsPage.posts.some((post) => post.id === postId),
    false,
    "user B's scoped posts must not include user A's post",
  );

  const forbiddenProfileUpdate = await b
    .from('app_users')
    .update({ name: 'must-not-change' })
    .eq('id', idA)
    .select('id');
  assert.equal(forbiddenProfileUpdate.error, null);
  assert.deepEqual(forbiddenProfileUpdate.data, []);

  await unwrap(
    'store own push token',
    a
      .from('push_tokens')
      .upsert({
        platform: 'ios',
        token: `ExponentPushToken[integration-${suffix}]`,
        user_id: idA,
      })
      .select('user_id')
      .single(),
  );

  // events/missions write path: 0003's blanket grant never covered these two
  // tables (see 0012), so table privileges — not just RLS — must now allow
  // the owner to insert/update/delete while rejecting a non-owner's update.
  const event = await unwrap(
    'create event as user A',
    a
      .from('events')
      .insert({
        created_by: idA,
        date_label: 'Jan 1',
        day_label: 'THU',
        featured: false,
        going_base: 0,
        place: 'Integration Pavilion',
        seed_attendee_ids: [],
        starts_at: new Date().toISOString(),
        tag: 'Integration',
        time_label: '6:00 PM',
        title,
      })
      .select('id')
      .single(),
  );
  assert(event);
  eventId = event.id as string;

  const unauthorizedEventUpdate = await b
    .from('events')
    .update({ title: `${title}-tampered` })
    .eq('id', eventId)
    .select('id');
  assert.equal(unauthorizedEventUpdate.error, null);
  assert.deepEqual(unauthorizedEventUpdate.data, []);

  const ownerEventUpdate = await unwrap(
    'update own event',
    a
      .from('events')
      .update({ place: 'Updated Pavilion' })
      .eq('id', eventId)
      .select('id')
      .single(),
  );
  assert(ownerEventUpdate);

  const unauthorizedEventDelete = await b
    .from('events')
    .delete()
    .eq('id', eventId)
    .select('id');
  assert.equal(unauthorizedEventDelete.error, null);
  assert.deepEqual(unauthorizedEventDelete.data, []);

  // getMyEventsViewSupabase: this merges a "created by me" query with a
  // "joined by me" query (no single keyset query can express that OR), so
  // it needs its own coverage beyond the raw RLS checks above.
  await unwrap(
    'user B joins event as part of getMyEventsView coverage',
    b.from('event_joins').insert({ event_id: eventId, user_id: idB }),
  );
  const myEventsForA = await getMyEventsViewSupabase(a, idA, 20, null);
  assert(myEventsForA.events.some((event) => event.id === eventId));

  const myEventsForB = await getMyEventsViewSupabase(b, idB, 20, null);
  const joinedEvent = myEventsForB.events.find((event) => event.id === eventId);
  assert(joinedEvent, "user B's joined event should appear via getMyEventsView");
  assert.equal(joinedEvent?.joined, true);

  const missionSeedId = `msn-integration-${suffix}`;
  const mission = await unwrap(
    'create mission as user A',
    a
      .from('missions')
      .insert({
        created_by: idA,
        description: 'RLS integration fixture',
        icon: 'Star',
        id: missionSeedId,
        locked_by_default: false,
        position: 999,
        stops_total: 1,
        title,
        xp: 10,
      })
      .select('id')
      .single(),
  );
  assert(mission);
  missionId = mission.id as string;

  const unauthorizedMissionUpdate = await b
    .from('missions')
    .update({ title: `${title}-tampered` })
    .eq('id', missionId)
    .select('id');
  assert.equal(unauthorizedMissionUpdate.error, null);
  assert.deepEqual(unauthorizedMissionUpdate.data, []);

  const ownerMissionUpdate = await unwrap(
    'update own mission',
    a
      .from('missions')
      .update({ xp: 20 })
      .eq('id', missionId)
      .select('id')
      .single(),
  );
  assert(ownerMissionUpdate);

  const unauthorizedMissionDelete = await b
    .from('missions')
    .delete()
    .eq('id', missionId)
    .select('id');
  assert.equal(unauthorizedMissionDelete.error, null);
  assert.deepEqual(unauthorizedMissionDelete.data, []);

  // getMyMissionsViewSupabase: merges "created by me" with "completed by
  // me" (again, no single keyset query can express that OR).
  await unwrap(
    'user B completes the mission as part of getMyMissionsView coverage',
    b
      .from('mission_progress')
      .upsert({ mission_id: missionId, status: 'done', stops_done: 1, user_id: idB }),
  );
  const myMissionsForA = await getMyMissionsViewSupabase(a, idA, 20, null);
  assert(myMissionsForA.missions.some((mission) => mission.id === missionId));

  const myMissionsForB = await getMyMissionsViewSupabase(b, idB, 20, null);
  const completedMission = myMissionsForB.missions.find(
    (mission) => mission.id === missionId,
  );
  assert(
    completedMission,
    "user B's completed mission should appear via getMyMissionsView",
  );
  assert.equal(completedMission?.status, 'done');

  // Storage RLS: object keys encode the owning post's id (posts/{postId}/...),
  // not the acting user's id, so ownership must be checked via a table lookup
  // (public.owns_media_object) rather than a direct key/JWT comparison. This
  // proves a non-owner is rejected by Storage itself, not just the app layer.
  const ownerUploadPath = `posts/${postId}/rls-owner-${suffix}.png`;
  const hostileUploadPath = `posts/${postId}/rls-hostile-${suffix}.png`;
  const fixtureBytes = Buffer.from('rls-storage-fixture');

  const ownerUpload = await a.storage
    .from('llv-community-media')
    .upload(ownerUploadPath, fixtureBytes, { contentType: 'image/png' });
  assert.equal(ownerUpload.error, null, 'owner upload should succeed');

  const hostileUpload = await b.storage
    .from('llv-community-media')
    .upload(hostileUploadPath, fixtureBytes, { contentType: 'image/png' });
  assert.notEqual(
    hostileUpload.error,
    null,
    'non-owner upload to another user\'s post should be rejected',
  );

  const hostileDelete = await b.storage
    .from('llv-community-media')
    .remove([ownerUploadPath]);
  assert.notEqual(
    hostileDelete.error,
    null,
    'non-owner delete of another user\'s post media should be rejected',
  );

  const ownerDelete = await a.storage
    .from('llv-community-media')
    .remove([ownerUploadPath]);
  assert.equal(ownerDelete.error, null, 'owner delete should succeed');

  // send_event_day_reminders: recipient scoping (creator + joiners only, not
  // a blanket broadcast), idempotency, DST-correct local-hour gating across
  // both offsets, and reminder_sent_at clearing on reschedule.
  const reminderEvent = await unwrap(
    'create event for reminder test',
    a
      .from('events')
      .insert({
        created_by: idA,
        date_label: 'Jul 15',
        day_label: 'WED',
        featured: false,
        going_base: 0,
        place: 'Reminder Pavilion',
        seed_attendee_ids: [],
        starts_at: '2026-07-15T18:00:00Z',
        tag: 'Integration',
        time_label: '11:00 AM',
        title: `${title}-reminder`,
      })
      .select('id')
      .single(),
  );
  assert(reminderEvent);
  reminderEventId = reminderEvent.id as string;

  await unwrap(
    'user B joins reminder event',
    b.from('event_joins').insert({ event_id: reminderEventId, user_id: idB }),
  );

  const countEventReminderNotifications = async (): Promise<number> => {
    const rows = await unwrap(
      'count reminder notifications',
      a
        .from('notifications')
        .select('id')
        .in('user_id', [idA, idB])
        .eq('kind', 'event')
        .contains('data', { eventId: reminderEventId }),
    );
    assert(rows);
    return rows.length;
  };

  // Wrong hour on the same UTC day (1pm PDT, not 8am) — must be a no-op.
  await unwrap(
    'call reminder function outside the target hour',
    a.rpc('send_event_day_reminders', { check_time: '2026-07-15T20:00:00Z' }),
  );
  assert.equal(await countEventReminderNotifications(), 0);

  // 8am PDT (July = daylight time, UTC-7) on the event's day — should fire
  // for the creator and the joiner, not a third, unconnected member.
  await unwrap(
    'call reminder function at 8am PDT',
    a.rpc('send_event_day_reminders', { check_time: '2026-07-15T15:00:00Z' }),
  );
  assert.equal(await countEventReminderNotifications(), 2);

  // Calling again with the same reference time must not double-send.
  await unwrap(
    'call reminder function again (idempotency)',
    a.rpc('send_event_day_reminders', { check_time: '2026-07-15T15:00:00Z' }),
  );
  assert.equal(await countEventReminderNotifications(), 2);

  // Reschedule to a January date — the reminder marker must clear so the
  // event can be reminded again on its new day.
  await unwrap(
    'reschedule reminder event to a new day',
    a
      .from('events')
      .update({ starts_at: '2026-01-15T18:00:00Z' })
      .eq('id', reminderEventId),
  );
  const rescheduled = await unwrap(
    'read reminder_sent_at after reschedule',
    a.from('events').select('reminder_sent_at').eq('id', reminderEventId).single(),
  );
  assert.equal(
    (rescheduled as { reminder_sent_at: string | null }).reminder_sent_at,
    null,
    'reminder_sent_at should reset when the event moves to a new day',
  );

  // 8am PST (January = standard time, UTC-8) on the new day — proves the
  // local-hour gate is correct for the other DST offset, not just PDT.
  await unwrap(
    'call reminder function at 8am PST after reschedule',
    a.rpc('send_event_day_reminders', { check_time: '2026-01-15T16:00:00Z' }),
  );
  assert.equal(await countEventReminderNotifications(), 4);

  // send_mission_deadline_reminders: idempotency and reschedule-reset,
  // mirroring the event coverage above (recipient scoping there is already
  // narrow — mission_progress.status = 'active' — so isn't re-tested here).
  const reminderMissionSeedId = `msn-reminder-${suffix}`;
  const reminderMission = await unwrap(
    'create mission for reminder test',
    a
      .from('missions')
      .insert({
        created_by: idA,
        description: 'Reminder integration fixture',
        icon: 'Star',
        id: reminderMissionSeedId,
        locked_by_default: false,
        position: 998,
        scheduled_for: '2026-07-15',
        stops_total: 1,
        title: `${title}-mission-reminder`,
        xp: 10,
      })
      .select('id')
      .single(),
  );
  assert(reminderMission);
  reminderMissionId = reminderMission.id as string;

  await unwrap(
    'user A starts the reminder mission',
    a
      .from('mission_progress')
      .upsert({ mission_id: reminderMissionId, status: 'active', user_id: idA }),
  );

  const countMissionReminderNotifications = async (): Promise<number> => {
    const rows = await unwrap(
      'count mission reminder notifications',
      a
        .from('notifications')
        .select('id')
        .eq('user_id', idA)
        .eq('kind', 'mission')
        .contains('data', { missionId: reminderMissionId }),
    );
    assert(rows);
    return rows.length;
  };

  await unwrap(
    'call mission reminder function at 8am PDT',
    a.rpc('send_mission_deadline_reminders', { check_time: '2026-07-15T15:00:00Z' }),
  );
  assert.equal(await countMissionReminderNotifications(), 1);

  await unwrap(
    'call mission reminder function again (idempotency)',
    a.rpc('send_mission_deadline_reminders', { check_time: '2026-07-15T15:00:00Z' }),
  );
  assert.equal(await countMissionReminderNotifications(), 1);

  await unwrap(
    'reschedule reminder mission to a new day',
    a
      .from('missions')
      .update({ scheduled_for: '2026-01-15' })
      .eq('id', reminderMissionId),
  );
  const missionProgressAfterReschedule = await unwrap(
    'read mission_progress reminder_sent_at after reschedule',
    a
      .from('mission_progress')
      .select('reminder_sent_at')
      .eq('mission_id', reminderMissionId)
      .eq('user_id', idA)
      .single(),
  );
  assert.equal(
    (missionProgressAfterReschedule as { reminder_sent_at: string | null })
      .reminder_sent_at,
    null,
    'reminder_sent_at should reset when the mission moves to a new day',
  );

  await unwrap(
    'call mission reminder function at 8am PST after reschedule',
    a.rpc('send_mission_deadline_reminders', { check_time: '2026-01-15T16:00:00Z' }),
  );
  assert.equal(await countMissionReminderNotifications(), 2);

  // send_weekly_digest: a community-wide recap, not a per-user reminder —
  // fires once for every member with notif_digest on, gated to Monday 8am
  // local time (both DST offsets), idempotent per recapped week, and counts
  // only content whose timestamp actually falls in that week.
  await unwrap(
    'enable digest preference for user A',
    a.from('app_users').update({ notif_digest: true }).eq('id', idA).select('id').single(),
  );

  const digestPost = await unwrap(
    'create post inside the digest window',
    a
      .from('posts')
      .insert({
        author_id: idA,
        created_at: '2026-07-15T18:00:00Z',
        excerpt: 'Digest window fixture',
        forum: 'Dining',
        title: `${title}-digest-post`,
      })
      .select('id')
      .single(),
  );
  assert(digestPost);
  digestPostId = digestPost.id as string;

  const digestEvent = await unwrap(
    'create event inside the digest window',
    a
      .from('events')
      .insert({
        created_by: idA,
        date_label: 'Jul 15',
        day_label: 'WED',
        featured: false,
        going_base: 5,
        place: 'Digest Pavilion',
        seed_attendee_ids: [],
        starts_at: '2026-07-15T18:00:00Z',
        tag: 'Integration',
        time_label: '11:00 AM',
        title: `${title}-digest-event`,
      })
      .select('id')
      .single(),
  );
  assert(digestEvent);
  digestEventId = digestEvent.id as string;

  const digestMissionSeedId = `msn-digest-${suffix}`;
  const digestMission = await unwrap(
    'create mission for digest completion fixture',
    a
      .from('missions')
      .insert({
        created_by: idA,
        description: 'Digest window fixture',
        icon: 'Star',
        id: digestMissionSeedId,
        locked_by_default: false,
        position: 997,
        title: `${title}-digest-mission`,
        xp: 15,
      })
      .select('id')
      .single(),
  );
  assert(digestMission);
  digestMissionId = digestMission.id as string;

  await unwrap(
    'complete digest mission inside the digest window',
    a.from('mission_progress').upsert({
      completed_at: '2026-07-15T18:00:00Z',
      mission_id: digestMissionId,
      status: 'done',
      stops_done: 1,
      user_id: idA,
    }),
  );

  const countDigestNotifications = async (userId: string): Promise<number> => {
    const rows = await unwrap(
      'count digest notifications',
      a.from('notifications').select('id,body').eq('user_id', userId).eq('kind', 'digest'),
    );
    assert(rows);
    return rows.length;
  };

  // Wrong hour on a Monday — must be a no-op.
  await unwrap(
    'call digest function outside the target hour',
    a.rpc('send_weekly_digest', { check_time: '2026-07-20T20:00:00Z' }),
  );
  assert.equal(await countDigestNotifications(idA), 0);

  // 8am PDT (July = daylight time, UTC-7) on the Monday after the fixture
  // week — should fire for user A (digest preference on) and recap exactly
  // the fixtures created above.
  await unwrap(
    'call digest function at 8am PDT on the recap Monday',
    a.rpc('send_weekly_digest', { check_time: '2026-07-20T15:00:00Z' }),
  );
  assert.equal(await countDigestNotifications(idA), 1);
  assert.equal(
    await countDigestNotifications(idB),
    0,
    'user B has notif_digest off and must not receive a digest',
  );
  const digestNotificationRows = await unwrap(
    'read the digest notification body',
    a
      .from('notifications')
      .select('body')
      .eq('user_id', idA)
      .eq('kind', 'digest')
      .order('created_at', { ascending: false })
      .limit(1),
  );
  assert(digestNotificationRows);
  const [digestNotification] = digestNotificationRows as { body: string }[];
  assert(digestNotification);
  assert(
    digestNotification.body.startsWith('1 posts, 1 events, 1 missions completed'),
    'digest body should reflect the exact fixture counts',
  );

  // Calling again with the same reference time must not double-send for the
  // same recapped week.
  await unwrap(
    'call digest function again for the same week (idempotency)',
    a.rpc('send_weekly_digest', { check_time: '2026-07-20T15:00:00Z' }),
  );
  assert.equal(await countDigestNotifications(idA), 1);

  // 8am PST (January = standard time, UTC-8) on a different Monday — proves
  // the local-hour/weekday gate is correct for the other DST offset too, and
  // that a new week is independently eligible to fire.
  await unwrap(
    'call digest function at 8am PST on a different Monday',
    a.rpc('send_weekly_digest', { check_time: '2026-01-19T16:00:00Z' }),
  );
  assert.equal(await countDigestNotifications(idA), 2);

  // listNotificationsSupabase: cursor pagination against a real keyset query
  // (the reminder calls above guarantee idA has at least two rows by now).
  const notificationsFirstPage = await listNotificationsSupabase(a, idA, 1, null);
  assert.equal(notificationsFirstPage.notifications.length, 1);
  assert(
    notificationsFirstPage.nextCursor,
    'expected more than one notification to paginate through',
  );

  const notificationsSecondPage = await listNotificationsSupabase(
    a,
    idA,
    1,
    notificationsFirstPage.nextCursor,
  );
  assert.equal(notificationsSecondPage.notifications.length, 1);
  assert.notEqual(
    notificationsFirstPage.notifications[0]?.id,
    notificationsSecondPage.notifications[0]?.id,
    'each page should return a distinct notification',
  );

  // toggle_bookmark (0013_bookmarks.sql): two concurrent toggles on the same
  // not-yet-bookmarked target must both resolve to bookmarked=true rather
  // than one throwing a unique-violation error — the SECURITY DEFINER
  // function treats a losing concurrent insert as success, since the
  // desired "bookmarked" end state was already reached by the other call.
  const [concurrentToggleOne, concurrentToggleTwo] = await Promise.all([
    toggleBookmarkSupabase(a, idA, 'post', postId),
    toggleBookmarkSupabase(a, idA, 'post', postId),
  ]);
  assert.equal(
    concurrentToggleOne,
    true,
    'first concurrent toggle should report bookmarked',
  );
  assert.equal(
    concurrentToggleTwo,
    true,
    'second concurrent toggle should also report bookmarked, not throw a unique-violation error',
  );

  const bookmarkRowsAfterConcurrentAdd = await unwrap(
    'read bookmark rows after concurrent toggle',
    a
      .from('bookmarks')
      .select('id')
      .eq('user_id', idA)
      .eq('target_type', 'post')
      .eq('target_id', postId),
  );
  assert(bookmarkRowsAfterConcurrentAdd);
  assert.equal(
    bookmarkRowsAfterConcurrentAdd.length,
    1,
    'concurrent adds on the same target must not create a duplicate row',
  );

  await unwrap(
    'clean up bookmark created during concurrency test',
    a
      .from('bookmarks')
      .delete()
      .eq('user_id', idA)
      .eq('target_type', 'post')
      .eq('target_id', postId),
  );

  console.log(
    'Supabase integration passed: RLS identity isolation, writes, triggers, ' +
      'push-token ownership, events/missions owner-write grants, Storage owner ' +
      'scoping, scheduled reminder recipient scoping/idempotency/DST/reschedule ' +
      'behavior, atomic concurrent bookmark toggles, and the weekly digest ' +
      'function preference gating/idempotency/DST behavior.',
  );
} finally {
  if (postId) {
    const cleanup = await a.from('posts').delete().eq('id', postId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  if (secondPostId) {
    const cleanup = await a.from('posts').delete().eq('id', secondPostId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  if (eventId) {
    const cleanup = await a.from('events').delete().eq('id', eventId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  if (missionId) {
    const cleanup = await a.from('missions').delete().eq('id', missionId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  // Notifications have no delete RLS policy (only insert-via-trigger and
  // mark-as-read are exposed to users — see 0003), so the reminder rows
  // created above are left in place; they reference an event/mission id
  // that's about to be deleted and are otherwise harmless test residue.
  if (reminderEventId) {
    const cleanup = await a.from('events').delete().eq('id', reminderEventId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  if (reminderMissionId) {
    const cleanup = await a.from('missions').delete().eq('id', reminderMissionId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  if (digestPostId) {
    const cleanup = await a.from('posts').delete().eq('id', digestPostId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  if (digestEventId) {
    const cleanup = await a.from('events').delete().eq('id', digestEventId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
  if (digestMissionId) {
    // mission_progress rows cascade-delete with the mission (on delete
    // cascade). The two weekly_digest_runs marker rows this test created
    // have no delete RLS policy (an internal-only tracking table nothing
    // else references) and are left in place as harmless residue, same as
    // the reminder notifications above.
    const cleanup = await a.from('missions').delete().eq('id', digestMissionId);
    if (cleanup.error) {
      console.error(`Supabase integration cleanup failed: ${cleanup.error.message}`);
      process.exitCode = 1;
    }
  }
}

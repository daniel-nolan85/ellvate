import { describe, expect, test } from 'bun:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getMemberActivityCountsSupabase,
  getMemberRowSupabase,
} from '../../src/backend/profile/public-profile-supabase';

interface FakeMemberRow {
  readonly id: string;
  readonly name: string;
  readonly avatar_url: string | null;
  readonly role: string | null;
  readonly interests: readonly string[];
  readonly activity_visible: boolean;
}

// A minimal fake covering only the chain getMemberRowSupabase actually calls
// (select().eq().maybeSingle()) on app_users, plus a write-call counter. Ian's
// review flagged that the old implementation routed through ensureUser(),
// which attempts an insert/upsert against a row the requester does not own —
// something the "insert own app_user" RLS policy (id = clerk_user_id()) would
// reject for anyone viewing someone else's profile. This proves the read-only
// replacement never attempts a write at all, regardless of RLS.
function createFakeSupabase(rows: Readonly<Record<string, FakeMemberRow>>) {
  const writes = { count: 0 };

  const from = (table: string) => {
    let filterId: string | undefined;
    return {
      select: () => ({
        eq: (column: string, value: string) => {
          if (column === 'id') {
            filterId = value;
          }
          return {
            maybeSingle: async () => {
              if (table !== 'app_users' || !filterId) {
                return { data: null, error: null };
              }
              return { data: rows[filterId] ?? null, error: null };
            },
          };
        },
      }),
      upsert: () => {
        writes.count += 1;
        return { data: null, error: null };
      },
      insert: () => {
        writes.count += 1;
        return { data: null, error: null };
      },
    };
  };

  const client = { from } as unknown as SupabaseClient;
  return { client, writes };
}

describe('getMemberRowSupabase (requester differs from member)', () => {
  test('returns the member row for an existing member without writing anything', async () => {
    const { client, writes } = createFakeSupabase({
      'user-other': {
        activity_visible: true,
        avatar_url: 'https://example.com/avatar.jpg',
        id: 'user-other',
        interests: ['Kayaking'],
        name: 'Other Neighbour',
        role: 'resident',
      },
    });

    const row = await getMemberRowSupabase(client, 'user-other');

    expect(row).toEqual({
      activityVisible: true,
      avatarUrl: 'https://example.com/avatar.jpg',
      id: 'user-other',
      interests: ['Kayaking'],
      name: 'Other Neighbour',
      role: 'resident',
    });
    expect(writes.count).toBe(0);
  });

  test('returns null for an unknown member without creating a ghost row', async () => {
    const { client, writes } = createFakeSupabase({});

    const row = await getMemberRowSupabase(client, 'user-does-not-exist');

    expect(row).toBeNull();
    expect(writes.count).toBe(0);
  });
});

describe('getMemberActivityCountsSupabase', () => {
  test('calls the member_activity_counts RPC once instead of 6 separate head-count queries', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const client = {
      rpc: (fn: string, args: Record<string, unknown>) => {
        calls.push({ args, fn });
        return {
          single: () =>
            Promise.resolve({
              data: {
                events_attended: 3,
                events_created: 3,
                missions_created: 3,
                petitions_started: 3,
                posts_count: 3,
                services_listed: 3,
              },
              error: null,
            }),
        };
      },
    } as unknown as SupabaseClient;

    const counts = await getMemberActivityCountsSupabase(client, 'user-other');

    expect(counts).toEqual({
      eventsAttended: 3,
      eventsCreated: 3,
      missionsCreated: 3,
      petitionsStarted: 3,
      postsCount: 3,
      servicesListed: 3,
    });
    expect(calls).toEqual([
      { args: { member_id: 'user-other' }, fn: 'member_activity_counts' },
    ]);
  });
});

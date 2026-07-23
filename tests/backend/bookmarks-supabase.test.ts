import { describe, expect, test } from 'bun:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  BookmarkTargetNotFoundError,
  toggleBookmarkSupabase,
} from '../../src/backend/bookmarks/bookmarks-supabase';
import { SupabaseRequestError } from '../../src/services/supabase/errors';

// A minimal fake covering only what toggleBookmarkSupabase actually calls
// (app_users.upsert, then rpc('toggle_bookmark')). The real atomicity
// guarantee lives in the SQL function itself (see 0013_bookmarks.sql) and is
// covered against a live database in scripts/run-supabase-integration.ts;
// this proves the JS wrapper maps the RPC's outcomes correctly.
function createFakeSupabase(rpcResult: { data?: unknown; error?: { message: string } | null }) {
  const rpcCalls: unknown[] = [];
  const client = {
    from: () => ({
      upsert: async () => ({ data: null, error: null }),
    }),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ args, fn });
      return Promise.resolve({ data: rpcResult.data ?? null, error: rpcResult.error ?? null });
    },
  } as unknown as SupabaseClient;
  return { client, rpcCalls };
}

describe('toggleBookmarkSupabase', () => {
  test('returns true when the RPC reports the bookmark was added', async () => {
    const { client, rpcCalls } = createFakeSupabase({ data: true });

    const result = await toggleBookmarkSupabase(client, 'user-a', 'post', 'post-1');

    expect(result).toBe(true);
    expect(rpcCalls).toEqual([
      { args: { p_target_id: 'post-1', p_target_type: 'post' }, fn: 'toggle_bookmark' },
    ]);
  });

  test('returns false when the RPC reports the bookmark was removed', async () => {
    const { client } = createFakeSupabase({ data: false });

    const result = await toggleBookmarkSupabase(client, 'user-a', 'post', 'post-1');

    expect(result).toBe(false);
  });

  test('throws BookmarkTargetNotFoundError when the RPC rejects a deleted target', async () => {
    const { client } = createFakeSupabase({ error: { message: 'target_not_found' } });

    await expect(
      toggleBookmarkSupabase(client, 'user-a', 'post', 'post-deleted'),
    ).rejects.toBeInstanceOf(BookmarkTargetNotFoundError);
  });

  test('surfaces any other RPC error as a generic request failure, not a silent success', async () => {
    const { client } = createFakeSupabase({ error: { message: 'connection reset' } });

    await expect(
      toggleBookmarkSupabase(client, 'user-a', 'post', 'post-1'),
    ).rejects.toBeInstanceOf(SupabaseRequestError);
  });
});

import type { SupabaseClient } from '@supabase/supabase-js';

import type { BookmarkTargetType, StoredBookmark } from '@/src/backend/store';
import { decodeCursor, encodeCursor } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { BookmarkIdEntry } from './types';

interface BookmarkRow {
  readonly id: string;
  readonly user_id: string;
  readonly target_type: BookmarkTargetType;
  readonly target_id: string;
  readonly created_at: string;
}

const toStoredBookmark = (row: BookmarkRow): StoredBookmark => ({
  createdAt: row.created_at,
  id: row.id,
  targetId: row.target_id,
  targetType: row.target_type,
  userId: row.user_id,
});

// A new Clerk user has no app_users row yet; create it before the owned
// write so the bookmarks foreign key resolves. RLS allows inserting only
// your own row.
const ensureUser = async (supabase: SupabaseClient, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name: 'Member' }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure bookmark user');
};

// Thrown when the RPC's own internal existence check rejects the target —
// this only fires in the narrow race where the target is deleted between
// the app-level targetExists() check and this call; the caller maps it to
// the same target_not_found result that check normally returns.
export class BookmarkTargetNotFoundError extends Error {}

// Delegates to a SECURITY DEFINER SQL function (toggle_bookmark, see
// 0013_bookmarks.sql) that validates the target and performs the
// delete-or-insert as one atomic statement. A plain check-then-write here
// would let two rapid taps both see "not bookmarked" and both attempt an
// insert, so the unique constraint would reject the loser as a hard error
// instead of a deterministic toggle.
export async function toggleBookmarkSupabase(
  supabase: SupabaseClient,
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string,
): Promise<boolean> {
  await ensureUser(supabase, userId);
  const { data, error } = await supabase.rpc('toggle_bookmark', {
    p_target_id: targetId,
    p_target_type: targetType,
  });
  if (error?.message === 'target_not_found') {
    throw new BookmarkTargetNotFoundError('Bookmark target no longer exists.');
  }
  throwIfSupabaseError(error, 'toggle bookmark');
  return Boolean(data);
}

export async function listBookmarksSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  cursor: string | null,
  targetType: BookmarkTargetType | undefined,
): Promise<{ readonly records: readonly StoredBookmark[]; readonly nextCursor: string | null }> {
  let query = supabase
    .from('bookmarks')
    .select('id,user_id,target_type,target_id,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (targetType) {
    query = query.eq('target_type', targetType);
  }

  const parsedCursor = cursor ? decodeCursor(cursor) : null;
  if (parsedCursor) {
    query = query.or(
      `created_at.lt.${parsedCursor.sortKey},and(created_at.eq.${parsedCursor.sortKey},id.lt.${parsedCursor.id})`,
    );
  }

  const { data, error } = await query;
  throwIfSupabaseError(error, 'load bookmarks');
  const rows = (data ?? []) as unknown as BookmarkRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ id: last.id, sortKey: last.created_at }) : null;

  return { nextCursor, records: page.map(toStoredBookmark) };
}

// Returns every one of the caller's bookmark ids, unbounded — see the
// matching comment on listBookmarkIdsMemory for why a display-only cap here
// would be unsafe (it would make a real toggle silently delete a save the
// cap just couldn't see).
export async function listBookmarkIdsSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<readonly BookmarkIdEntry[]> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('target_type,target_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  throwIfSupabaseError(error, 'load bookmark ids');
  return ((data ?? []) as { target_type: BookmarkTargetType; target_id: string }[]).map(
    (row) => ({ targetId: row.target_id, targetType: row.target_type }),
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { createClerkClient } from '@clerk/backend';

import { getBackendAuthMode } from '@/src/backend/http';
import { throwIfSupabaseError } from '@/src/services/supabase';
import { removeStorageObjects } from '@/src/services/storage';

interface MediaItem {
  readonly url: string;
}

// Storage cleanup mirrors the pattern deleteEventSupabase/
// deleteServiceListingSupabase already use for a single item: fetch the
// owned rows' media URLs while the rows (and owner-scoped Storage RLS
// checks against them) still exist, remove the Storage objects, then delete
// the rows. Events/missions the user created are NOT included here — their
// FK is ON DELETE SET NULL (orphaned, not deleted, see migration 0004), so
// their media stays with the surviving event/mission.
export async function deleteAccountSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const [userRes, postsRes, listingsRes] = await Promise.all([
    supabase.from('app_users').select('avatar_url').eq('id', userId).maybeSingle(),
    supabase.from('posts').select('media').eq('author_id', userId),
    supabase.from('service_listings').select('logo,media').eq('created_by', userId),
  ]);
  throwIfSupabaseError(userRes.error, 'load account before deletion');
  throwIfSupabaseError(postsRes.error, 'load owned posts before deletion');
  throwIfSupabaseError(
    listingsRes.error,
    'load owned service listings before deletion',
  );

  const avatarUrl = (userRes.data?.avatar_url as string | null) ?? null;
  const postMediaUrls = (
    (postsRes.data ?? []) as { readonly media: readonly MediaItem[] | null }[]
  )
    .flatMap((row) => row.media ?? [])
    .map((item) => item.url);
  const listingMediaUrls = (
    (listingsRes.data ?? []) as {
      readonly logo: MediaItem | null;
      readonly media: readonly MediaItem[] | null;
    }[]
  )
    .flatMap((row) => [...(row.logo ? [row.logo] : []), ...(row.media ?? [])])
    .map((item) => item.url);

  const ownedMediaUrls = [
    ...(avatarUrl ? [avatarUrl] : []),
    ...postMediaUrls,
    ...listingMediaUrls,
  ];
  if (ownedMediaUrls.length > 0) {
    await removeStorageObjects(supabase, ownedMediaUrls);
  }

  // Deleting the row cascades everything the user owns — posts, comments,
  // reports, mission/event comments, service listings/reviews, mutes,
  // bookmarks, notifications (see the ON DELETE CASCADE foreign keys added
  // across migrations 0001/0004/0007/0013/0017/0020) — and SETs NULL on
  // events.created_by / missions.created_by, orphaning rather than deleting
  // community content they authored.
  const { error } = await supabase.from('app_users').delete().eq('id', userId);
  throwIfSupabaseError(error, 'delete account');

  // The app row (and everything it cascaded) is gone at this point even if
  // the Clerk call below fails — deliberate, so a transient Clerk API issue
  // never leaves the user's data behind. The caller still sees this reject.
  if (getBackendAuthMode() === 'clerk') {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (secretKey) {
      await createClerkClient({ secretKey }).users.deleteUser(userId);
    }
  }
}

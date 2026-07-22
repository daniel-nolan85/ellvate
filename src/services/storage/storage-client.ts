import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const BUCKET = 'llv-community-media';
const PUBLIC_URL_PREFIX = url
  ? `${url}/storage/v1/object/public/${BUCKET}/`
  : null;

export const getStorageUrl = (path: string): string => {
  if (!url) return '';
  return `${PUBLIC_URL_PREFIX}${path}`;
};

// Recovers the Storage object key from a public URL previously returned by
// `getStorageUrl`/`uploadDataUrl`, or null if it wasn't issued by this bucket.
export const storagePathFromUrl = (mediaUrl: string): string | null => {
  if (!PUBLIC_URL_PREFIX || !mediaUrl.startsWith(PUBLIC_URL_PREFIX)) {
    return null;
  }
  return mediaUrl.slice(PUBLIC_URL_PREFIX.length);
};

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

// Uploads a base64 data URL (as produced by expo-image-picker's `base64`
// option) to Supabase Storage under a collision-safe key and returns its
// public URL, or null if the payload isn't a valid data URL.
//
// WHY: `supabase` must be the per-request client created via
// `createRequestClient` (carrying the caller's Clerk JWT) so Storage's RLS
// policies see an authenticated identity — a freshly-built anonymous client
// would bypass owner-scoped upload policies entirely.
export const uploadDataUrl = async (
  supabase: SupabaseClient,
  dataUrl: string,
  filename: string,
  folder: string,
  ownerId: string,
): Promise<string | null> => {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    return null;
  }
  const [, contentType, base64] = match;
  // WHY: prefixing with a UUID avoids collisions between two picked files
  // that share a name (e.g. two "IMG_0001.jpg" from a camera roll) — the
  // original filename is kept only for display, not as the storage key.
  const path = `${folder}/${ownerId}/${crypto.randomUUID()}-${filename}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(base64, 'base64'), { contentType, upsert: false });

  if (error) {
    console.error('Upload failed:', error);
    return null;
  }

  return getStorageUrl(path);
};

// Best-effort cleanup of Storage objects that are no longer referenced
// (avatar replaced, media removed on edit, or the owning post/event/mission
// deleted). Failures are logged, not thrown — a stray object left behind is
// far less harmful than blocking the caller's primary write on housekeeping.
export const removeStorageObjects = async (
  supabase: SupabaseClient,
  urls: readonly string[],
): Promise<void> => {
  const paths = urls
    .map(storagePathFromUrl)
    .filter((path): path is string => path !== null);
  if (paths.length === 0) {
    return;
  }
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    console.error('Storage cleanup failed:', error);
  }
};

export interface RawMediaUpload {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface RawExistingMedia {
  readonly filename: string;
  readonly url: string;
}

const MAX_MEDIA_ITEMS = 10;

// WHY: images are sent as data URLs (base64) from the client so the memory
// backend can display them without a storage round trip; the Supabase
// backend decodes and re-uploads the same payload to real storage.
export function extractMediaUploads(input: unknown): readonly RawMediaUpload[] {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  if (!Array.isArray(raw.newMedia)) {
    return [];
  }
  return raw.newMedia
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      dataUrl: typeof item.dataUrl === 'string' ? item.dataUrl : '',
      filename: typeof item.filename === 'string' ? item.filename : 'upload',
    }))
    .filter((item) => item.dataUrl.startsWith('data:'))
    .slice(0, MAX_MEDIA_ITEMS);
}

// WHY: when editing, the client sends back the subset of already-uploaded
// media the user chose to keep (no re-upload needed) alongside any newly
// picked images in `extractMediaUploads`.
export function extractExistingMedia(
  input: unknown,
): readonly RawExistingMedia[] {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  if (!Array.isArray(raw.existingMedia)) {
    return [];
  }
  return raw.existingMedia
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      filename: typeof item.filename === 'string' ? item.filename : 'upload',
      url: typeof item.url === 'string' ? item.url : '',
    }))
    .filter((item) => item.url.length > 0)
    .slice(0, MAX_MEDIA_ITEMS);
}

// WHY: an avatar is a single image, not a gallery — reads `raw.avatar` (one
// object) rather than the array field the gallery uploads use.
export function extractAvatarUpload(input: unknown): RawMediaUpload | null {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const avatar =
    typeof raw.avatar === 'object' && raw.avatar !== null
      ? (raw.avatar as Record<string, unknown>)
      : null;
  if (!avatar) {
    return null;
  }
  const dataUrl = typeof avatar.dataUrl === 'string' ? avatar.dataUrl : '';
  if (!dataUrl.startsWith('data:')) {
    return null;
  }
  return {
    dataUrl,
    filename: typeof avatar.filename === 'string' ? avatar.filename : 'avatar',
  };
}

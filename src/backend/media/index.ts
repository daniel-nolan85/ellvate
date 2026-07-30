export interface RawMediaUpload {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface RawExistingMedia {
  readonly filename: string;
  readonly url: string;
}

// WHY: thrown (not returned) so a single malformed/oversized item rejects the
// whole request with a stable 4xx via `withRequestContext`, instead of the
// caller silently truncating or shipping a half-uploaded post.
export class MediaValidationError extends Error {
  readonly code: string;
  readonly status = 400 as const;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MediaValidationError';
    this.code = code;
  }
}

const MAX_MEDIA_ITEMS = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 40 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);
const DATA_URL_PATTERN = /^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const decodedByteLength = (base64: string): number => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const assertValidFilename = (filename: string): void => {
  if (!FILENAME_PATTERN.test(filename)) {
    throw new MediaValidationError(
      'media_invalid_filename',
      `Invalid filename: "${filename}".`,
    );
  }
};

// Validates a `data:` upload's shape, MIME allowlist, and size, returning its
// decoded byte length so callers can enforce an aggregate request cap.
const assertValidDataUrl = (dataUrl: string): number => {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new MediaValidationError(
      'media_invalid_data_url',
      'Media must be a base64-encoded data URL.',
    );
  }
  const [, contentType, base64] = match;
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new MediaValidationError(
      'media_unsupported_type',
      `Unsupported media type: "${contentType}".`,
    );
  }
  const bytes = decodedByteLength(base64);
  if (bytes > MAX_FILE_BYTES) {
    throw new MediaValidationError(
      'media_too_large',
      `Each image must be under ${MAX_FILE_BYTES / (1024 * 1024)}MB.`,
    );
  }
  return bytes;
};

// WHY: images are sent as data URLs (base64) from the client so the memory
// backend can display them without a storage round trip; the Supabase
// backend decodes and re-uploads the same payload to real storage. Items
// that aren't shaped like a data URL at all are dropped (the client simply
// didn't attach anything new); items that ARE a data URL but violate a
// limit are treated as a real validation failure and reject the request.
export function extractMediaUploads(input: unknown): readonly RawMediaUpload[] {
  const raw = isRecord(input) ? input : {};
  if (!Array.isArray(raw.newMedia)) {
    return [];
  }
  const items = raw.newMedia
    .filter(isRecord)
    .map((item) => ({
      dataUrl: typeof item.dataUrl === 'string' ? item.dataUrl : '',
      filename: typeof item.filename === 'string' ? item.filename : 'upload',
    }))
    .filter((item) => item.dataUrl.startsWith('data:'));

  if (items.length > MAX_MEDIA_ITEMS) {
    throw new MediaValidationError(
      'media_too_many_items',
      `You can upload up to ${MAX_MEDIA_ITEMS} files per request.`,
    );
  }

  let totalBytes = 0;
  for (const item of items) {
    assertValidFilename(item.filename);
    totalBytes += assertValidDataUrl(item.dataUrl);
  }
  if (totalBytes > MAX_REQUEST_BYTES) {
    throw new MediaValidationError(
      'media_request_too_large',
      `Total upload size must be under ${MAX_REQUEST_BYTES / (1024 * 1024)}MB.`,
    );
  }

  return items;
}

// WHY: when editing, the client sends back the subset of already-uploaded
// media the user chose to keep (no re-upload needed) alongside any newly
// picked images in `extractMediaUploads`.
export function extractExistingMedia(
  input: unknown,
): readonly RawExistingMedia[] {
  const raw = isRecord(input) ? input : {};
  if (!Array.isArray(raw.existingMedia)) {
    return [];
  }
  const items = raw.existingMedia
    .filter(isRecord)
    .map((item) => ({
      filename: typeof item.filename === 'string' ? item.filename : 'upload',
      url: typeof item.url === 'string' ? item.url : '',
    }))
    .filter((item) => item.url.length > 0);

  if (items.length > MAX_MEDIA_ITEMS) {
    throw new MediaValidationError(
      'media_too_many_items',
      `You can keep up to ${MAX_MEDIA_ITEMS} files per request.`,
    );
  }
  for (const item of items) {
    assertValidFilename(item.filename);
  }

  return items;
}

// WHY: an avatar is a single image, not a gallery — reads `raw.avatar` (one
// object) rather than the array field the gallery uploads use. A missing or
// non-data-url avatar is treated as "no change" (matches the gallery items'
// permissive handling of an absent/garbage value); a well-formed data URL
// that violates a limit is a real validation failure and rejects the request.
export function extractAvatarUpload(input: unknown): RawMediaUpload | null {
  const raw = isRecord(input) ? input : {};
  const avatar = isRecord(raw.avatar) ? raw.avatar : null;
  if (!avatar) {
    return null;
  }
  const dataUrl = typeof avatar.dataUrl === 'string' ? avatar.dataUrl : '';
  if (!dataUrl.startsWith('data:')) {
    return null;
  }
  const filename =
    typeof avatar.filename === 'string' ? avatar.filename : 'avatar';
  assertValidFilename(filename);
  assertValidDataUrl(dataUrl);

  return { dataUrl, filename };
}

// WHY: a business logo is a single image like an avatar, not a gallery item
// — reads `raw.logo` rather than the `newMedia` array field. Mirrors
// extractAvatarUpload's permissive/strict split (missing or malformed shape
// is "no change"; a real data URL that violates a limit rejects the request).
export function extractLogoUpload(input: unknown): RawMediaUpload | null {
  const raw = isRecord(input) ? input : {};
  const logo = isRecord(raw.logo) ? raw.logo : null;
  if (!logo) {
    return null;
  }
  const dataUrl = typeof logo.dataUrl === 'string' ? logo.dataUrl : '';
  if (!dataUrl.startsWith('data:')) {
    return null;
  }
  const filename = typeof logo.filename === 'string' ? logo.filename : 'logo';
  assertValidFilename(filename);
  assertValidDataUrl(dataUrl);

  return { dataUrl, filename };
}

// WHY: when editing, the client sends back the current logo (unchanged) as
// `existingLogo`, or omits it entirely to remove the logo — mirrors
// extractExistingMedia's kept-subset contract but for a single item.
export function extractExistingLogo(input: unknown): RawExistingMedia | null {
  const raw = isRecord(input) ? input : {};
  const logo = isRecord(raw.existingLogo) ? raw.existingLogo : null;
  if (!logo) {
    return null;
  }
  const url = typeof logo.url === 'string' ? logo.url : '';
  if (!url) {
    return null;
  }
  const filename = typeof logo.filename === 'string' ? logo.filename : 'logo';
  assertValidFilename(filename);

  return { filename, url };
}

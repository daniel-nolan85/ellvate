import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

export const getStorageClient = () => {
  if (!url || !publishableKey) {
    return null;
  }
  return createClient(url, publishableKey).storage;
};

export const getStorageUrl = (path: string): string => {
  if (!url) return '';
  return `${url}/storage/v1/object/public/llv-community-media/${path}`;
};

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

// Uploads a base64 data URL (as produced by expo-image-picker's `base64`
// option) to Supabase Storage under `${folder}/${ownerId}/${filename}` and
// returns its public URL, or null if Supabase isn't configured or the
// payload isn't a valid data URL.
export const uploadDataUrl = async (
  dataUrl: string,
  filename: string,
  folder: string,
  ownerId: string,
): Promise<string | null> => {
  const storage = getStorageClient();
  if (!storage) {
    return null;
  }
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    return null;
  }
  const [, contentType, base64] = match;
  const path = `${folder}/${ownerId}/${filename}`;
  const { error } = await storage
    .from('llv-community-media')
    .upload(path, Buffer.from(base64, 'base64'), { contentType, upsert: false });

  if (error) {
    console.error('Upload failed:', error);
    return null;
  }

  return getStorageUrl(path);
};

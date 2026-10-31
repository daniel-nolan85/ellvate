import { Share } from 'react-native';

import { File as LocalFile, Paths } from 'expo-file-system';

export interface ShareContentOptions {
  readonly text: string;
  // A remote photo already hosted for this content item (a post, event,
  // mission, or listing's first media image) -- not a local asset, so it has
  // to be downloaded before a native share sheet can attach it.
  readonly imageUrl?: string | null;
}

const inferImageMimeType = (url: string): string => {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.gif')) {
    return 'image/gif';
  }
  return 'image/jpeg';
};

// WHY dynamic import, not a static one at the top of this file: same reason
// as src/platform/share-card/share-card.ts -- react-native-share's native
// module binds the moment its JS wrapper is evaluated, throwing immediately
// if the native module isn't compiled into the running binary yet. This app
// ships over OTA updates before the native build that adds a new native
// module reaches everyone, so a binary without it must not crash -- it
// should just fall back to a text-only share.
export async function shareContent({
  imageUrl,
  text,
}: ShareContentOptions): Promise<void> {
  if (imageUrl) {
    // WHY Awaited<ReturnType<...>> rather than naming LocalFile directly:
    // expo-file-system's own .d.ts has two structurally different `File`
    // declarations (the public class vs. the narrower one its native-module
    // interface returns) -- downloadFileAsync's declared return type is the
    // narrower one, which annotating this as `LocalFile` doesn't match. Both
    // declarations carry the only members used below (`uri`, `delete()`), so
    // letting TS infer the real return type sidesteps the mismatch entirely.
    let downloaded: Awaited<ReturnType<typeof LocalFile.downloadFileAsync>> | undefined;
    try {
      const RNShare = (await import('react-native-share')).default;
      downloaded = await LocalFile.downloadFileAsync(imageUrl, Paths.cache, {
        idempotent: true,
      });
      await RNShare.open({
        message: text,
        type: inferImageMimeType(imageUrl),
        url: downloaded.uri,
      });
      return;
    } catch {
      // Native module not available in this binary yet, the image failed to
      // download, or the share sheet was dismissed without choosing a
      // target (RNShare.open rejects on cancel) -- fall back below.
    } finally {
      // Best-effort cleanup; Paths.cache is already OS-reclaimable, so a
      // failure here (including "never downloaded") is not worth surfacing.
      try {
        downloaded?.delete();
      } catch {
        // ignore
      }
    }
  }
  await Share.share({ message: text });
}

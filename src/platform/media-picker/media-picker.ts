import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  readonly uri: string;
  readonly base64: string;
  readonly filename: string;
  readonly mimeType: string;
}

export interface PickGalleryImagesOptions {
  readonly selectionLimit: number;
}

const toPickedImage = (asset: ImagePicker.ImagePickerAsset): PickedImage => ({
  base64: asset.base64!,
  filename: asset.fileName ?? `image-${Date.now()}.jpg`,
  mimeType: asset.mimeType ?? 'image/jpeg',
  uri: asset.uri,
});

// Picks up to `selectionLimit` images from the library for a media gallery
// (posts/events/missions) — no cropping, since a gallery holds multiple
// unedited photos. Returns [] if the user cancels or every picked asset
// lacks base64 data.
export async function pickGalleryImages(
  options: PickGalleryImagesOptions,
): Promise<readonly PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: true,
    base64: true,
    mediaTypes: ['images'],
    quality: 0.7,
    selectionLimit: options.selectionLimit,
  });
  if (result.canceled) {
    return [];
  }
  return result.assets
    .filter((asset) => asset.base64)
    .slice(0, options.selectionLimit)
    .map(toPickedImage);
}

// Picks and crops a single square image for a profile avatar. Returns null
// if the user cancels or the picked asset lacks base64 data.
export async function pickAvatarImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
    mediaTypes: ['images'],
    quality: 0.8,
  });
  const asset = result.canceled ? null : result.assets[0];
  return asset?.base64 ? toPickedImage(asset) : null;
}

import { Share } from 'react-native';

import { Asset } from 'expo-asset';

const CARD_ASSET = require('@/assets/images/spread-the-word-card.png');

// WHY dynamic import, not a static one at the top of this file: same reason
// as src/platform/review-prompt/review-prompt.ts -- react-native-share's
// native module binds the moment its JS wrapper is evaluated, throwing
// immediately if the native module isn't compiled into the running binary
// yet. This app ships over OTA updates before the native build that adds a
// new native module reaches everyone, so a binary without it must not
// crash -- it should just fall back to a text-only share.
export async function shareInviteCard(message: string): Promise<void> {
  try {
    const RNShare = (await import('react-native-share')).default;
    const asset = Asset.fromModule(CARD_ASSET);
    await asset.downloadAsync();
    if (asset.localUri) {
      await RNShare.open({ message, type: 'image/png', url: asset.localUri });
      return;
    }
  } catch {
    // Native module not available in this binary yet, the share sheet was
    // dismissed without choosing a target (RNShare.open rejects on
    // cancel), or the asset failed to resolve -- fall back below.
  }
  await Share.share({ message });
}

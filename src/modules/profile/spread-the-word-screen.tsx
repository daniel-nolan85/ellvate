import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Button, ButtonText } from '@/src/components/ui/button';
import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { publicEnvironment } from '@/src/platform/environment';
import { shareInviteCard } from '@/src/platform/share-card';

const CARD_ASSET = require('@/assets/images/spread-the-word-card.png');
// The rendered card's own pixel dimensions -- keeps the preview's aspect
// ratio correct regardless of the device's screen width.
const CARD_ASPECT_RATIO = 1200 / 1500;

function defaultCaption(link: string): string {
  return `Just joined eLLVate — a free app for Lake Las Vegas neighbors. Check it out: ${link}`;
}

export function SpreadTheWordScreen() {
  const insets = useSafeAreaInsets();
  const link = publicEnvironment.marketingUrl ?? 'https://ellvate.com';
  const [caption, setCaption] = useState(() => defaultCaption(link));
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (sharing) {
      return;
    }
    setSharing(true);
    try {
      await shareInviteCard(caption);
    } finally {
      setSharing(false);
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className="items-center gap-2 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityLabel="Back" onPress={() => router.back()}>
          <Icon name="ChevronLeft" size={22} />
        </Pressable>
        <Heading className="flex-1 font-inter-bold text-[16px]" size="sm">
          Spread the Word
        </Heading>
      </HStack>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}
      >
        <VStack space="lg">
          <Text className="px-1 text-[15px] leading-[22px] text-content">
            eLLVate gets more useful the more neighbors are on it — more forum
            chatter, more events, more local recommendations. It&apos;s free,
            so why not spread the word?
          </Text>

          <Image
            resizeMode="cover"
            source={CARD_ASSET}
            style={{
              aspectRatio: CARD_ASPECT_RATIO,
              borderColor: 'rgb(226,216,196)',
              borderRadius: 18,
              borderWidth: 1,
              width: '100%',
            }}
          />

          <VStack space="xs">
            <Text className="px-1 font-inter-semibold text-[13px] text-text-muted">
              Caption
            </Text>
            <GrowingTextInput
              className="rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] text-content"
              maxHeight={220}
              minHeight={90}
              onChangeText={setCaption}
              testID="spread-the-word-caption"
              value={caption}
            />
          </VStack>

          <Button
            className="rounded-full bg-accent"
            isDisabled={sharing || caption.trim().length === 0}
            onPress={handleShare}
            size="lg"
            testID="spread-the-word-share"
          >
            <Icon color="white" name="Share" size={16} />
            <ButtonText className="font-inter-semibold text-accent-foreground">
              Share
            </ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </View>
  );
}

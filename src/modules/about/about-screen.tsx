import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { publicEnvironment } from '@/src/platform/environment';

// Fixed developer-identity links, not tied to any deployment -- unlike
// EXPO_PUBLIC_MARKETING_URL below, these never change per environment.
const NOLANCODE_URL = 'https://www.nolancode.com';
const INSTAGRAM_URL = 'https://www.instagram.com/nolan_code';

function LinkRow({
  icon,
  label,
  url,
}: {
  readonly icon: AppIconName;
  readonly label: string;
  readonly url: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      className="flex-row items-center gap-3 border-b border-surface-hairline px-4 py-3.5"
      onPress={() => void Linking.openURL(url)}
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
        <Icon color="rgb(181,80,44)" name={icon} size={16} />
      </View>
      <Text className="flex-1 font-inter-medium text-[15px] text-content">
        {label}
      </Text>
      <Icon color="rgb(169,156,139)" name="Link" size={16} />
    </Pressable>
  );
}

export function AboutScreen() {
  const insets = useSafeAreaInsets();
  const marketingUrl = publicEnvironment.marketingUrl;

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
          About
        </Heading>
      </HStack>

      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <VStack space="sm">
          <Text className="px-1 pb-2 text-[13px] leading-[19px] text-text-muted">
            eLLVate is designed and built by Nolancode.
          </Text>
          <VStack className="overflow-hidden rounded-[18px] border border-surface-hairline bg-paper shadow-card">
            <LinkRow
              icon="Laptop"
              label="Nolancode portfolio"
              url={NOLANCODE_URL}
            />
            {marketingUrl ? (
              <LinkRow icon="Globe" label="eLLVate website" url={marketingUrl} />
            ) : null}
            <LinkRow
              icon="AtSign"
              label="@nolan_code on Instagram"
              url={INSTAGRAM_URL}
            />
          </VStack>
        </VStack>
      </ScrollView>
    </View>
  );
}

import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { NotificationBellButton } from '@/src/modules/notifications';
import { ProfileAvatarButton } from '@/src/modules/profile';

interface ScreenTitleProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly right?: ReactNode;
  readonly onSearch?: () => void;
  readonly showAvatar?: boolean;
}

// Icons (avatar, search, bell) always sit in their own fixed row so they
// never reshuffle between screens, and the eyebrow/title get their own full
// -width row below so a longer title never has to compete for space and wrap
// to a second line. showAvatar defaults to true; the Profile screen sets it
// false since a button that opens your own profile from your own profile is
// circular.
export function ScreenTitle({
  eyebrow,
  title,
  right,
  onSearch,
  showAvatar = true,
}: ScreenTitleProps) {
  return (
    <VStack className="gap-2 px-5 pb-2 pt-2">
      <HStack className={showAvatar ? 'items-center justify-between' : 'items-center justify-end'}>
        {showAvatar ? <ProfileAvatarButton /> : null}
        <HStack className="items-center gap-4">
          {onSearch ? (
            <Pressable
              accessibilityLabel="Search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onSearch}
            >
              <Icon name="Search" size={22} />
            </Pressable>
          ) : null}
          <NotificationBellButton />
        </HStack>
      </HStack>
      <HStack className="items-center gap-3">
        <VStack className="flex-1 gap-1">
          <Text className="font-inter-bold uppercase text-accent text-[11px] tracking-[1.4px]">
            {eyebrow}
          </Text>
          <Heading className="font-inter-extrabold tracking-[-0.9px]" size="2xl">
            {title}
          </Heading>
        </VStack>
        {right}
      </HStack>
    </VStack>
  );
}

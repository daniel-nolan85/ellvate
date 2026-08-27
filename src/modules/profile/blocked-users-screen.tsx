import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/src/components/ui/avatar';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';

import { useOpenProfile } from './use-open-profile';
import { useBlockUser, useBlockedUsers, type BlockedMember } from './use-block-user';

function BlockedRow({
  member,
  onOpenProfile,
  onUnblock,
  unblocking,
}: {
  readonly member: BlockedMember;
  readonly onOpenProfile: () => void;
  readonly onUnblock: () => void;
  readonly unblocking: boolean;
}) {
  return (
    <HStack className="items-center gap-3 border-b border-surface-hairline px-4 py-3.5">
      <Pressable
        accessibilityLabel={`Open ${member.name}'s profile`}
        accessibilityRole="button"
        className="flex-1 flex-row items-center gap-3"
        onPress={onOpenProfile}
      >
        <Avatar name={member.name} size="sm" src={member.avatarUrl ?? undefined} />
        <Text
          className="flex-1 font-inter-semibold text-[14px] text-content"
          numberOfLines={1}
        >
          {member.name}
        </Text>
      </Pressable>
      <Button
        action="secondary"
        className="rounded-full bg-secondary px-4"
        isDisabled={unblocking}
        onPress={onUnblock}
        size="sm"
      >
        <ButtonText className="font-inter-semibold text-[12px] text-content">
          {unblocking ? 'Unblocking…' : 'Unblock'}
        </ButtonText>
      </Button>
    </HStack>
  );
}

export function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const blockedUsers = useBlockedUsers();
  const blockUser = useBlockUser();
  const openProfile = useOpenProfile();
  const items = blockedUsers.data?.blocked ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ paddingTop: insets.top }}>
        <ScreenTitle eyebrow="Privacy" title="Blocked users" />
      </View>

      {blockedUsers.isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="xlarge" />
        </VStack>
      ) : items.length === 0 ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="EyeOff" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            You haven&apos;t blocked anyone. A blocked neighbour&apos;s posts,
            comments, events, missions, and services stay hidden from you
            until you unblock them here.
          </Text>
        </VStack>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
          <VStack className="mx-5 mt-2 overflow-hidden rounded-[18px] border border-surface-hairline bg-paper shadow-card">
            {items.map((member) => (
              <BlockedRow
                key={member.userId}
                member={member}
                onOpenProfile={() => openProfile(member.userId, member.name)}
                onUnblock={() => blockUser.mutate(member.userId)}
                unblocking={
                  blockUser.isPending && blockUser.variables === member.userId
                }
              />
            ))}
          </VStack>
        </ScrollView>
      )}

      <CommunityNavBar />
    </View>
  );
}

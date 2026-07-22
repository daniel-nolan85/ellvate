import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { useMemberProfile } from './use-profile';

const ROLE_LABELS: Record<string, string> = {
  business: 'Local business',
  new: 'New to the area',
  resident: 'Resident',
  visitor: 'Visitor',
};

interface MemberProfileScreenProps {
  readonly userId: string;
  // Non-authoritative: only used as loading-state placeholder text before the
  // real profile loads. The authoritative name always comes from the API
  // response (member.data.profile.name), never from this caller-supplied value.
  readonly loadingName?: string;
  readonly onClose: () => void;
}

function StatCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <VStack
      className='flex-1 items-center rounded-2xl bg-secondary py-3.5'
      space='xs'
    >
      <Text className='font-inter-bold text-[20px] text-content'>{value}</Text>
      <Text className='text-text-muted' size='xs'>
        {label}
      </Text>
    </VStack>
  );
}

export function MemberProfileScreen({
  loadingName,
  onClose,
  userId,
}: MemberProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const member = useMemberProfile(userId);
  const displayName = member.data?.profile.name ?? loadingName ?? 'Neighbour';

  return (
    <View className='flex-1 bg-canvas'>
      <HStack
        className='items-center justify-between px-5 pb-3'
        style={{ paddingTop: insets.top + 12 }}
      >
        <Heading className='font-inter-bold' size='xl'>
          Neighbour
        </Heading>
        <Pressable
          accessibilityLabel='Close'
          className='h-9 w-9 items-center justify-center rounded-full bg-secondary'
          onPress={onClose}
        >
          <Icon name='Close' size={18} />
        </Pressable>
      </HStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <VStack className='items-center px-5 pb-2 pt-3' space='sm'>
          <Avatar
            name={displayName}
            size='2xl'
            src={member.data?.profile.avatarUrl ?? undefined}
          />
          <Heading className='font-inter-bold' size='lg'>
            {displayName}
          </Heading>
        </VStack>

        {member.isPending ? (
          <View className='items-center py-10'>
            <Spinner size='large' />
          </View>
        ) : member.isError ? (
          <Text className='px-5 text-center text-text-muted' size='sm'>
            Couldn&apos;t load this profile.
          </Text>
        ) : (
          <VStack className='gap-4 px-5 pt-4'>
            <HStack space='sm'>
              <StatCard
                label='Level'
                value={String(member.data.stats?.level ?? 1)}
              />
              <StatCard label='XP' value={String(member.data.stats?.xp ?? 0)} />
              <StatCard
                label='Missions'
                value={String(member.data.stats?.missionsCompleted ?? 0)}
              />
              <StatCard
                label='Streak'
                value={String(member.data.stats?.streakDays ?? 0)}
              />
            </HStack>

            <VStack space='sm'>
              <Text className='font-inter-bold text-content' size='sm'>
                Community role
              </Text>
              <Text className='text-text-muted' size='sm'>
                {member.data.profile.role
                  ? ROLE_LABELS[member.data.profile.role]
                  : 'Not shared'}
              </Text>
            </VStack>

            {member.data.profile.interests.length > 0 ? (
              <VStack space='sm'>
                <Text className='font-inter-bold text-content' size='sm'>
                  Interests
                </Text>
                <HStack className='flex-wrap gap-2'>
                  {member.data.profile.interests.map((interest) => (
                    <Badge key={interest} variant='indigo'>
                      {interest}
                    </Badge>
                  ))}
                </HStack>
              </VStack>
            ) : null}
          </VStack>
        )}
      </ScrollView>
    </View>
  );
}

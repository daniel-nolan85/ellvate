import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  CATEGORY_ACCENT_ICON_COLOR,
  CATEGORY_CHIP_ACTIVE_TREATMENT,
  type CategoryAccent,
} from '@/src/lib/category-accent';

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
  icon,
  label,
  onPress,
  tone,
  value,
}: {
  readonly icon: AppIconName;
  readonly label: string;
  readonly value: string;
  readonly tone: CategoryAccent;
  readonly onPress?: () => void;
}) {
  return (
    <Pressable
      className='flex-1 items-center gap-2 rounded-2xl border border-surface-hairline bg-paper py-3.5 shadow-card'
      disabled={!onPress}
      onPress={onPress}
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-full ${CATEGORY_CHIP_ACTIVE_TREATMENT[tone].bg}`}
      >
        <Icon color={CATEGORY_ACCENT_ICON_COLOR[tone]} name={icon} size={16} />
      </View>
      <Text className='font-inter-bold text-[18px] text-content'>{value}</Text>
      <Text className='text-center text-text-muted' size='xs'>
        {label}
      </Text>
    </Pressable>
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
  // Aggregate figures below are always shown; the detailed activity list is
  // opt-in, so only open it when this member has chosen to share it.
  const activityShared = member.data?.profile.activityVisible ?? false;

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
            <Spinner size='xlarge' />
          </View>
        ) : member.isError ? (
          <Text className='px-5 text-center text-text-muted' size='sm'>
            Couldn&apos;t load this profile.
          </Text>
        ) : (
          <VStack className='gap-4 px-5 pt-4'>
            <HStack space='sm'>
              <StatCard
                icon='Trophy'
                label='Level'
                tone='accent'
                value={String(member.data.stats?.level ?? 1)}
              />
              <StatCard
                icon='Sparkles'
                label='XP'
                tone='amber'
                value={String(member.data.stats?.xp ?? 0)}
              />
              <StatCard
                icon='Star'
                label='Missions'
                tone='palm'
                value={String(member.data.stats?.missionsCompleted ?? 0)}
              />
              <StatCard
                icon='Footprints'
                label='Streak'
                tone='amber'
                value={String(member.data.stats?.streakDays ?? 0)}
              />
            </HStack>

            <VStack space='sm'>
              <Text className='font-inter-bold text-content' size='sm'>
                Activity
              </Text>
              <HStack space='sm'>
                <StatCard
                  icon='MessageCircle'
                  label='Posts'
                  onPress={
                    activityShared
                      ? () => router.push(`/member/${userId}/activity?filter=post`)
                      : undefined
                  }
                  tone='plum'
                  value={String(member.data.stats?.postsCount ?? 0)}
                />
                <StatCard
                  icon='CalendarDays'
                  label='Events created'
                  onPress={
                    activityShared
                      ? () => router.push(`/member/${userId}/activity?filter=event`)
                      : undefined
                  }
                  tone='lake'
                  value={String(member.data.stats?.eventsCreated ?? 0)}
                />
                <StatCard
                  icon='CalendarDays'
                  label='Events attended'
                  onPress={
                    activityShared
                      ? () => router.push(`/member/${userId}/activity?filter=event`)
                      : undefined
                  }
                  tone='lake'
                  value={String(member.data.stats?.eventsAttended ?? 0)}
                />
              </HStack>
              <HStack space='sm'>
                <StatCard
                  icon='Star'
                  label='Missions created'
                  onPress={
                    activityShared
                      ? () => router.push(`/member/${userId}/activity?filter=mission`)
                      : undefined
                  }
                  tone='palm'
                  value={String(member.data.stats?.missionsCreated ?? 0)}
                />
                <StatCard
                  icon='Star'
                  label='Missions completed'
                  onPress={
                    activityShared
                      ? () => router.push(`/member/${userId}/activity?filter=mission`)
                      : undefined
                  }
                  tone='palm'
                  value={String(member.data.stats?.missionsCompleted ?? 0)}
                />
                <StatCard
                  icon='Store'
                  label='Services listed'
                  onPress={
                    activityShared
                      ? () => router.push(`/member/${userId}/activity?filter=service`)
                      : undefined
                  }
                  tone='accent'
                  value={String(member.data.stats?.servicesListed ?? 0)}
                />
              </HStack>
            </VStack>

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

            <VStack space='sm'>
              <Text className='font-inter-bold text-content' size='sm'>
                Interests
              </Text>
              {member.data.profile.interests.length > 0 ? (
                <HStack className='flex-wrap gap-2'>
                  {member.data.profile.interests.map((interest) => (
                    <Badge key={interest} variant='accent'>
                      {interest}
                    </Badge>
                  ))}
                </HStack>
              ) : (
                <Text className='text-text-muted' size='sm'>
                  None selected yet
                </Text>
              )}
            </VStack>
          </VStack>
        )}
      </ScrollView>
    </View>
  );
}

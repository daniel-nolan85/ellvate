import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { ConfirmModal } from '@/src/components/ui/confirm-modal';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  CATEGORY_ACCENT_ICON_COLOR,
  CATEGORY_CHIP_ACTIVE_TREATMENT,
  type CategoryAccent,
} from '@/src/lib/category-accent';
import { useSession } from '@/src/platform/session';

import { useBlockUser, useBlockedUsers, useReportMember } from './use-block-user';
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
  const session = useSession();
  const member = useMemberProfile(userId);
  const displayName = member.data?.profile.name ?? loadingName ?? 'Neighbour';
  // Aggregate figures below are always shown; the detailed activity list is
  // opt-in, so only open it when this member has chosen to share it.
  const activityShared = member.data?.profile.activityVisible ?? false;

  // useOpenProfile never routes here for your own id (it sends you to
  // /profile instead), but a hand-crafted deep link could still reach this
  // screen with your own userId -- guard against offering to block yourself.
  const isSelf = (session.userId ?? 'demo-user') === userId;
  const blockedUsers = useBlockedUsers();
  const blockUser = useBlockUser();
  const reportMember = useReportMember();
  const isBlocked = blockedUsers.data?.blocked.some(
    (blocked) => blocked.userId === userId,
  ) ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const handleBlock = () => {
    setConfirmBlockOpen(false);
    blockUser.mutate(userId, {
      onError: () => showToast('Couldn’t block this neighbour. Try again.'),
      onSuccess: onClose,
    });
  };

  const handleUnblock = () => {
    setMenuOpen(false);
    blockUser.mutate(userId, {
      onError: () => showToast('Couldn’t unblock this neighbour. Try again.'),
      onSuccess: () => showToast(`Unblocked ${displayName}`),
    });
  };

  // Closes the menu sheet first and waits for its close animation before
  // opening the confirm modal -- both are native Modals, so presenting one
  // while the other is still mounted risks the same concurrent-modal
  // freeze this app has hit before with two overlapping RN Modals.
  const openConfirmBlock = () => {
    setMenuOpen(false);
    setTimeout(() => setConfirmBlockOpen(true), CLOSE_DURATION);
  };

  const handleReport = () => {
    setMenuOpen(false);
    reportMember.mutate(userId, {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => showToast('Thanks — our moderators will take a look.'),
    });
  };

  return (
    <View className='flex-1 bg-canvas'>
      {/* No manual close button -- this screen is presented as a native
          formSheet (see app/_layout.tsx), whose own grabber, swipe-to-
          dismiss, and tap-outside already cover closing it. A `formSheet`
          page's content starts well below the physical top edge, so this
          only needs a small fixed gap, not insets.top -- unlike Sheet's
          statusBarTranslucent custom Modal, which spans behind the notch. */}
      <HStack className='items-center justify-between px-5 pb-3 pt-6'>
        <Heading className='font-inter-bold' size='xl'>
          Neighbour
        </Heading>
        {!isSelf && !blockedUsers.isPending ? (
          <Pressable
            accessibilityLabel='More options'
            className='h-9 w-9 items-center justify-center rounded-full bg-secondary'
            onPress={() => setMenuOpen(true)}
          >
            <Icon name='ThreeDots' size={18} />
          </Pressable>
        ) : null}
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
                <StatCard
                  icon='FileSignature'
                  label='Petitions started'
                  onPress={
                    activityShared
                      ? () => router.push(`/member/${userId}/activity?filter=petition`)
                      : undefined
                  }
                  tone='plum'
                  value={String(member.data.stats?.petitionsStarted ?? 0)}
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

      <Sheet onClose={() => setMenuOpen(false)} visible={menuOpen}>
        <View className='gap-1 px-[18px] pb-2'>
          <Pressable
            accessibilityRole='button'
            className='flex-row items-center gap-3 px-1.5 py-3.5'
            onPress={() => (isBlocked ? handleUnblock() : openConfirmBlock())}
          >
            <Icon name={isBlocked ? 'Eye' : 'EyeOff'} size={20} />
            <Text className='text-[15px]'>
              {isBlocked ? 'Unblock this neighbour' : 'Block this neighbour'}
            </Text>
          </Pressable>
          <Divider />
          <Pressable
            accessibilityRole='button'
            className='flex-row items-center gap-3 px-1.5 py-3.5'
            onPress={handleReport}
          >
            <Icon color='rgb(231,0,11)' name='AlertCircle' size={20} />
            <Text className='text-[15px]' style={{ color: 'rgb(231,0,11)' }}>
              Report this member
            </Text>
          </Pressable>
        </View>
      </Sheet>

      <ConfirmModal
        confirmLabel='Block'
        destructive
        message={`You won't see ${displayName}'s posts, comments, events, missions, or services anymore. Unblock them anytime from Profile → Blocked users.`}
        onClose={() => setConfirmBlockOpen(false)}
        onConfirm={handleBlock}
        title={`Block ${displayName}?`}
        visible={confirmBlockOpen}
      />

      {toast ? (
        <View
          className='absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3'
          style={{ bottom: insets.bottom + 24 }}
        >
          <Icon color='rgb(250,250,250)' name='AlertCircle' size={16} />
          <Text className='flex-1 text-[14px] text-primary-foreground'>
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

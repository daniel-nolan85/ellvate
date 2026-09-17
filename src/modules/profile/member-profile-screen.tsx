import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { ReportSheet, type ReportSubmission } from '@/src/components/shared/report-sheet';
import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { ConfirmModal } from '@/src/components/ui/confirm-modal';
import { Divider } from '@/src/components/ui/divider';
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
import { useSession } from '@/src/platform/session';
import { ApiError } from '@/src/services/api';

import { useBlockUser, useBlockedUsers, useReportMember } from './use-block-user';
import { useMemberProfile } from './use-profile';
import { XpHero } from './xp-hero';

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
      // px-1.5: the label below routinely wraps to two lines ("Missions
      // completed", "Services listed", "Petitions started") on a card this
      // narrow (4 per row); with no horizontal padding at all, wrapped
      // words sat flush against the card's rounded edges.
      className='flex-1 items-center gap-2 rounded-2xl border border-surface-hairline bg-paper px-1.5 py-3.5 shadow-card'
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
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
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
    blockUser.mutate(userId, {
      onError: () => showToast('Couldn’t unblock this neighbour. Try again.'),
      onSuccess: () => showToast(`Unblocked ${displayName}`),
    });
  };

  const openConfirmBlock = () => setConfirmBlockOpen(true);

  const handleReportSubmit = (submission: ReportSubmission) => {
    reportMember.mutate(
      { reportedUserId: userId, ...submission },
      {
        onError: () => showToast('Couldn’t submit your report. Try again.'),
        onSuccess: () => {
          setReportSheetOpen(false);
          showToast('Thanks — our moderators will take a look.');
        },
      },
    );
  };

  return (
    // This screen is always formSheet-presented, so `flex-1` on this root
    // is not a reliable way to fill the sheet's allocated detent height --
    // see SHEET_SCREEN_OPTIONS' own WHY (community-shell) for the underlying
    // react-native-screens quirk; contentStyle:{height:'100%'} there fixes
    // the *navigator's* wrapper, but this component's own root also needs
    // an explicit height rather than flex to actually stretch to match it.
    // collapsable={false} on this root (not just the header below) keeps it
    // from being flattened into that wrapper by RN's view-flattening
    // optimization -- the same #3092 class of bug the header fix below
    // targets, but at the container level.
    <View className='bg-canvas' collapsable={false} style={{ height: '100%' }}>
      {/* No manual close button -- this screen is presented as a native
          formSheet (see app/_layout.tsx), whose own grabber, swipe-to-
          dismiss, and tap-outside already cover closing it. A `formSheet`
          page's content starts well below the physical top edge, so this
          only needs a small fixed gap, not insets.top -- unlike Sheet's
          statusBarTranslucent custom Modal, which spans behind the notch.
          collapsable={false} works around a real react-native-screens bug
          (software-mansion/react-native-screens#3092): a formSheet screen
          whose root View has a background color can have RN's view-
          flattening optimization collapse this header's native view into
          its parent, which then lets the ScrollView below render on top of
          it instead of below it -- forcing this view to actually exist
          natively is the documented fix.

          Block/Report used to live behind a "..." button in this header, in
          four different implementations (a Sheet, an inline dropdown,
          ActionSheetIOS as this header's own 3rd child, then ActionSheetIOS
          moved back into this row as the header's 2nd child) -- every one
          reported as still doing nothing on-device, including the two that
          changed nothing about *what* opened the actions, only where the
          button itself lived. That rules out the button's rendering
          mechanism and points at touch handling specific to this general
          screen area instead: near the very top of a formSheet is also
          where UIKit's own interactive-dismiss gesture for the sheet lives,
          and it can claim touches ahead of this screen's own views without
          any RN-visible trace of doing so. Rather than try a fifth variant
          in the same zone, Block/Report now live as plain rows near the
          bottom of the ScrollView below instead, see there. */}
      {/* pt-9, not this app's usual pt-6 -- see digest-screen.tsx's identical
          WHY: the native grabber and the sheet's own rounded top corner
          already take up real space above a formSheet's first row, so the
          same fixed gap that reads fine on a plain pushed screen's header
          reads as cramped here specifically. */}
      <HStack className='items-center justify-between px-5 pb-3 pt-9' collapsable={false}>
        <Heading className='font-inter-bold' size='xl'>
          Neighbour
        </Heading>
      </HStack>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            onRefresh={() => void member.refetch()}
            refreshing={member.isRefetching}
          />
        }
      >
        <VStack className='items-center px-5 pb-2 pt-6' space='sm'>
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
          <VStack className='gap-1 px-5' space='xs'>
            <Text className='text-center text-text-muted' size='sm'>
              Couldn&apos;t load this profile.
            </Text>
            {/* Surfaces the actual failure instead of a silent dead end --
                this has come back reported as "not loading" with no further
                detail to diagnose from; showing the real status/message
                here means the next report can include it. */}
            <Text className='text-center text-[11px] text-text-subtle'>
              {member.error instanceof ApiError
                ? `Error ${member.error.status}${member.error.code ? ` (${member.error.code})` : ''}: ${member.error.message}`
                : member.error instanceof Error
                  ? member.error.message
                  : String(member.error)}
            </Text>
          </VStack>
        ) : (
          <VStack className='gap-4 px-5 pt-4'>
            {/* The same XpHero the signed-in user's own Profile screen
                shows (moved there from the Missions screen, which didn't
                need its own copy), not a second component. Missions stays
                covered exactly once, below, as "Missions completed" in the
                Activity grid -- this card only needs Level/XP, so no
                duplicate reappears. */}
            <XpHero
              level={member.data.stats?.level ?? 1}
              title={member.data.stats?.title ?? 'Lake Explorer'}
              xp={member.data.stats?.xp ?? 0}
              xpForNextLevel={member.data.stats?.xpForNextLevel ?? 0}
              xpIntoLevel={member.data.stats?.xpIntoLevel ?? 0}
              xpToNextLevel={member.data.stats?.xpToNextLevel ?? 0}
            />

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

            {!isSelf && !blockedUsers.isPending ? (
              <VStack className='pt-2'>
                <Divider />
                <Pressable
                  accessibilityRole='button'
                  className='flex-row items-center gap-3 py-3.5'
                  onPress={isBlocked ? handleUnblock : openConfirmBlock}
                >
                  <Icon name={isBlocked ? 'Eye' : 'EyeOff'} size={18} />
                  <Text className='text-[14px] text-content'>
                    {isBlocked ? 'Unblock this neighbour' : 'Block this neighbour'}
                  </Text>
                </Pressable>
                <Divider />
                <Pressable
                  accessibilityRole='button'
                  className='flex-row items-center gap-3 py-3.5'
                  onPress={() => setReportSheetOpen(true)}
                >
                  <Icon color='rgb(231,0,11)' name='AlertCircle' size={18} />
                  <Text className='text-[14px]' style={{ color: 'rgb(231,0,11)' }}>
                    Report this member
                  </Text>
                </Pressable>
              </VStack>
            ) : null}
          </VStack>
        )}
      </ScrollView>

      <ConfirmModal
        confirmLabel='Block'
        destructive
        message={`You won't see ${displayName}'s posts, comments, events, missions, or services anymore. Unblock them anytime from Profile → Blocked users.`}
        onClose={() => setConfirmBlockOpen(false)}
        onConfirm={handleBlock}
        title={`Block ${displayName}?`}
        visible={confirmBlockOpen}
      />

      {/* This screen's own Sheet/dropdown/ActionSheetIOS attempts for the
          old "..." menu all failed near the top of this formSheet screen
          (see the header's own comment above) -- this ReportSheet is
          triggered from a row near the bottom of the ScrollView instead, and
          is the only Sheet this screen ever mounts, so neither of those
          failure modes applies here. */}
      <ReportSheet
        isSubmitting={reportMember.isPending}
        onClose={() => setReportSheetOpen(false)}
        onSubmit={handleReportSubmit}
        title={`Report ${displayName}`}
        visible={reportSheetOpen}
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

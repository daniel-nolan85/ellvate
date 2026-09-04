import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Badge } from '@/src/components/ui/badge';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { EventSummaryCard, type CommunityEvent } from '@/src/modules/events';
import { PostCard, useToggleLike, type ForumPost } from '@/src/modules/forum';
import { ApiError } from '@/src/services/api';

import {
  useWeeklyDigest,
  type DigestCompletedMission,
  type DigestUpcomingEvent,
  type DigestUpcomingMission,
} from './use-digest';

interface DigestScreenProps {
  readonly weekStart?: string;
}

type DigestTab = 'recap' | 'comingUp';

const TABS: readonly { readonly key: DigestTab; readonly label: string }[] = [
  { key: 'recap', label: 'Last Week' },
  { key: 'comingUp', label: 'Coming Up' },
];

type OpenItem =
  | { readonly kind: 'post'; readonly post: ForumPost }
  | { readonly kind: 'event'; readonly event: CommunityEvent }
  | null;

function TabSwitcher({
  active,
  onSelect,
}: {
  readonly active: DigestTab;
  readonly onSelect: (tab: DigestTab) => void;
}) {
  return (
    <HStack className="px-5 pb-3" space="sm">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            className={`flex-1 items-center rounded-full py-2.5 ${
              isActive ? 'bg-accent' : 'bg-secondary'
            }`}
            key={tab.key}
            onPress={() => onSelect(tab.key)}
          >
            <Text
              className={`font-inter-semibold text-[13px] ${
                isActive ? 'text-accent-foreground' : 'text-secondary-foreground'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}

function StatBox({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <VStack className="flex-1 items-center rounded-2xl bg-secondary py-3.5" space="xs">
      <Text className="font-inter-bold text-[20px] text-content">{value}</Text>
      <Text className="text-text-muted" size="xs">
        {label}
      </Text>
    </VStack>
  );
}

function SectionHeader({ title }: { readonly title: string }) {
  return (
    <Text className="px-5 pb-1 pt-6 font-inter-bold text-[12px] uppercase tracking-[1px] text-text-muted">
      {title}
    </Text>
  );
}

function EmptyHint({ label }: { readonly label: string }) {
  return <Text className="px-5 pb-2 text-[13px] text-text-muted">{label}</Text>;
}

function PopularPostRow({
  onPress,
  post,
}: {
  readonly onPress: () => void;
  readonly post: ForumPost;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open post: ${post.title}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-line px-5 py-3.5"
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name="MessageCircle" size={16} />
      </View>
      <VStack className="flex-1 gap-0.5">
        <Text className="font-inter-bold text-[14px] text-content" numberOfLines={1}>
          {post.title}
        </Text>
        <Text className="text-[12px] text-text-muted">
          {post.likes} likes · {post.replies} replies
        </Text>
      </VStack>
      <Icon color="rgb(169,156,139)" name="ChevronRight" size={16} />
    </Pressable>
  );
}

function PopularEventRow({
  event,
  onPress,
}: {
  readonly event: CommunityEvent;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open event: ${event.title}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-line px-5 py-3.5"
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name="CalendarDays" size={16} />
      </View>
      <VStack className="flex-1 gap-0.5">
        <Text className="font-inter-bold text-[14px] text-content" numberOfLines={1}>
          {event.title}
        </Text>
        <Text className="text-[12px] text-text-muted">{event.going} going</Text>
      </VStack>
      <Icon color="rgb(169,156,139)" name="ChevronRight" size={16} />
    </Pressable>
  );
}

function CompletedMissionRow({
  mission,
  onPress,
}: {
  readonly mission: DigestCompletedMission;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open mission: ${mission.title}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-line px-5 py-3.5"
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name="Star" size={16} />
      </View>
      <VStack className="flex-1 gap-0.5">
        <Text className="font-inter-bold text-[14px] text-content" numberOfLines={1}>
          {mission.title}
        </Text>
        <Text className="text-[12px] text-text-muted">
          Completed by {mission.completedByCount}{' '}
          {mission.completedByCount === 1 ? 'person' : 'people'}
        </Text>
      </VStack>
      <Badge leftIcon={<Icon name="Star" size={11} />} variant="outline">
        {mission.xp} XP
      </Badge>
    </Pressable>
  );
}

function ComingUpEventRow({
  event,
  onPress,
}: {
  readonly event: DigestUpcomingEvent;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open event: ${event.title}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-line px-5 py-3.5"
      onPress={onPress}
    >
      <VStack className="flex-1 gap-0.5">
        <Text className="font-inter-bold text-[14px] text-content" numberOfLines={1}>
          {event.title}
        </Text>
        <Text className="text-[12px] text-text-muted">
          {event.dayLabel} {event.dateLabel} · {event.timeLabel}
        </Text>
      </VStack>
      <Icon color="rgb(169,156,139)" name="ChevronRight" size={16} />
    </Pressable>
  );
}

function ComingUpMissionRow({
  mission,
  onPress,
}: {
  readonly mission: DigestUpcomingMission;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open mission: ${mission.title}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-line px-5 py-3.5"
      onPress={onPress}
    >
      <VStack className="flex-1 gap-0.5">
        <Text className="font-inter-bold text-[14px] text-content" numberOfLines={1}>
          {mission.title}
        </Text>
        <Text className="text-[12px] text-text-muted">
          {formatDateOnly(mission.scheduledFor)}
        </Text>
      </VStack>
      <Icon color="rgb(169,156,139)" name="ChevronRight" size={16} />
    </Pressable>
  );
}

export function DigestScreen({ weekStart }: DigestScreenProps) {
  const insets = useSafeAreaInsets();
  const digest = useWeeklyDigest(weekStart);
  const toggleLike = useToggleLike();
  const [tab, setTab] = useState<DigestTab>('recap');
  const [openItem, setOpenItem] = useState<OpenItem>(null);

  // Close the sheet first and let it slide down, then navigate once the
  // close animation finishes — navigating immediately would unmount the
  // screen (and the sheet with it) mid-animation.
  const closeThenNavigate = (
    path: `/post/${string}` | `/event/${string}` | `/mission/${string}`,
  ) => {
    setOpenItem(null);
    setTimeout(() => router.push(path), CLOSE_DURATION);
  };

  return (
    <View className="flex-1 bg-canvas">
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
          its parent, which then lets the content below render on top of
          it instead of below it -- forcing this view to actually exist
          natively is the documented fix. */}
      <HStack className="items-center justify-between px-5 pb-1 pt-6" collapsable={false}>
        <Heading className="font-inter-bold" size="xl">
          Weekly Recap
        </Heading>
      </HStack>

      <TabSwitcher active={tab} onSelect={setTab} />

      {digest.isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="xlarge" />
        </VStack>
      ) : !digest.data ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="Newspaper" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            Couldn’t load this week’s recap. Try again shortly.
          </Text>
          {/* Surfaces the actual failure instead of a silent dead end -- this
              screen has repeatedly come back reported as "won't load" with
              no further detail to diagnose from; showing the real status/
              message here means the next report can include it. */}
          {digest.error ? (
            <Text className="text-center text-[11px] text-text-subtle">
              {digest.error instanceof ApiError
                ? `Error ${digest.error.status}${digest.error.code ? ` (${digest.error.code})` : ''}: ${digest.error.message}`
                : digest.error instanceof Error
                  ? digest.error.message
                  : String(digest.error)}
            </Text>
          ) : null}
        </VStack>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {tab === 'recap' ? (
            <>
              <Text className="px-5 pb-4 text-[13px] text-text-muted">
                {formatDateOnly(digest.data.weekStart)} – {formatDateOnly(digest.data.weekEnd)}
              </Text>

              <HStack className="px-5 pb-2" space="sm">
                <StatBox label="Posts" value={digest.data.stats.newPosts} />
                <StatBox label="Events" value={digest.data.stats.eventsHeld} />
                <StatBox label="Missions" value={digest.data.stats.missionsCompleted} />
                <StatBox label="Active" value={digest.data.stats.activeMembers} />
              </HStack>

              <SectionHeader title="Popular Posts" />
              {digest.data.popularPosts.length === 0 ? (
                <EmptyHint label="No posts stood out this week." />
              ) : (
                digest.data.popularPosts.map((post) => (
                  <PopularPostRow
                    key={post.id}
                    onPress={() => setOpenItem({ kind: 'post', post })}
                    post={post}
                  />
                ))
              )}

              <SectionHeader title="Popular Events" />
              {digest.data.popularEvents.length === 0 ? (
                <EmptyHint label="No events happened this week." />
              ) : (
                digest.data.popularEvents.map((event) => (
                  <PopularEventRow
                    event={event}
                    key={event.id}
                    onPress={() => setOpenItem({ event, kind: 'event' })}
                  />
                ))
              )}

              <SectionHeader title="Missions Completed" />
              {digest.data.completedMissions.length === 0 ? (
                <EmptyHint label="No missions were completed this week." />
              ) : (
                digest.data.completedMissions.map((mission) => (
                  <CompletedMissionRow
                    key={mission.id}
                    mission={mission}
                    onPress={() => router.push(`/mission/${mission.id}`)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <SectionHeader title="Events" />
              {digest.data.comingUpEvents.length === 0 ? (
                <EmptyHint label="Nothing on the calendar for the next week yet." />
              ) : (
                digest.data.comingUpEvents.map((event) => (
                  <ComingUpEventRow
                    event={event}
                    key={event.id}
                    onPress={() => router.push(`/event/${event.id}`)}
                  />
                ))
              )}

              <SectionHeader title="Missions" />
              {digest.data.comingUpMissions.length === 0 ? (
                <EmptyHint label="No missions scheduled for the next week yet." />
              ) : (
                digest.data.comingUpMissions.map((mission) => (
                  <ComingUpMissionRow
                    key={mission.id}
                    mission={mission}
                    onPress={() => router.push(`/mission/${mission.id}`)}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      <Sheet onClose={() => setOpenItem(null)} visible={openItem !== null}>
        {openItem?.kind === 'post' ? (
          <View className="px-1 pb-4">
            <PostCard
              onOpen={() => closeThenNavigate(`/post/${openItem.post.id}`)}
              onToggleLike={() =>
                toggleLike.mutate({ forum: openItem.post.forum, postId: openItem.post.id })
              }
              post={openItem.post}
            />
          </View>
        ) : null}
        {openItem?.kind === 'event' ? (
          <EventSummaryCard
            event={openItem.event}
            onOpen={(eventId) => closeThenNavigate(`/event/${eventId}`)}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

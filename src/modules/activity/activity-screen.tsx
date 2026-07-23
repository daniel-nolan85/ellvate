import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Badge } from '@/src/components/ui/badge';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { formatRelativeTime } from '@/src/lib/relative-time';
import {
  PostCard,
  useMyComments,
  useMyPosts,
  useToggleLike,
  type ForumPost,
  type MyComment,
} from '@/src/modules/forum';
import {
  EventSummaryCard,
  useMyEventsView,
  type CommunityEvent,
} from '@/src/modules/events';
import { MissionCard, useMyMissionsView, type Mission } from '@/src/modules/missions';
import { useSession } from '@/src/platform/session';

interface ActivityScreenProps {
  readonly onClose: () => void;
}

type ActivityKind = 'post' | 'event' | 'mission';
type ActivityFilter = 'all' | ActivityKind;

const KIND_ICON: Readonly<Record<ActivityKind, AppIconName>> = {
  event: 'CalendarDays',
  mission: 'Star',
  post: 'MessageCircle',
};

const KIND_LABEL: Readonly<Record<ActivityKind, string>> = {
  event: 'You created an event',
  mission: 'You created a mission',
  post: 'You created a post',
};

const COMMENT_LABEL = 'You commented on a post';
const MISSION_COMPLETED_LABEL = 'You completed a mission';
const EVENT_GOING_LABEL = 'You marked going to an event';

const FILTERS: readonly { readonly key: ActivityFilter; readonly label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'post', label: 'Posts' },
  { key: 'event', label: 'Events' },
  { key: 'mission', label: 'Missions' },
];

function FilterChips({
  active,
  onSelect,
}: {
  readonly active: ActivityFilter;
  readonly onSelect: (filter: ActivityFilter) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 2,
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
    >
      {FILTERS.map((filter) => {
        const isActive = filter.key === active;
        return (
          <Pressable
            className={`shrink-0 rounded-full px-3.5 py-[7px] ${
              isActive ? 'bg-primary' : 'bg-secondary'
            }`}
            key={filter.key}
            onPress={() => onSelect(filter.key)}
          >
            <Text
              className={`font-inter-medium text-[13px] leading-[18px] ${
                isActive ? 'text-primary-foreground' : 'text-secondary-foreground'
              }`}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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

function SectionHeader({
  count,
  title,
}: {
  readonly count: number;
  readonly title: string;
}) {
  return (
    <HStack className="items-center gap-2 px-5 pb-1 pt-6">
      <Text className="font-inter-bold text-[12px] uppercase tracking-[1px] text-text-muted">
        {title}
      </Text>
      <Badge variant="muted">{count}</Badge>
    </HStack>
  );
}

function EmptyHint({ label }: { readonly label: string }) {
  return <Text className="px-5 pb-2 text-[13px] text-text-muted">{label}</Text>;
}

function LoadMoreRow({
  isLoading,
  onPress,
}: {
  readonly isLoading: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="items-center py-3"
      disabled={isLoading}
      onPress={onPress}
    >
      {isLoading ? (
        <Spinner size="small" />
      ) : (
        <Text className="font-inter-semibold text-[13px] text-indigo">
          Load more
        </Text>
      )}
    </Pressable>
  );
}

function ActivityRow({
  kind,
  label,
  onPress,
  subtitle,
  title,
}: {
  readonly kind: ActivityKind;
  readonly label: string;
  readonly onPress: () => void;
  readonly subtitle: string;
  readonly title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}: ${title}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-line px-5 py-3.5"
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name={KIND_ICON[kind]} size={16} />
      </View>
      <VStack className="flex-1 gap-0.5">
        <Text className="text-[11px] text-text-muted">{label}</Text>
        <Text
          className="font-inter-bold text-[14px] text-content"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-[12px] text-text-muted">{subtitle}</Text>
      </VStack>
      <Icon color="rgb(161,161,170)" name="ChevronRight" size={16} />
    </Pressable>
  );
}

interface PostActivityItem {
  readonly key: string;
  readonly createdAt: string;
  readonly title: string;
  readonly label: string;
  readonly subtitle: string;
  readonly onPress: () => void;
}

interface MissionActivityItem {
  readonly key: string;
  readonly mission: Mission;
  readonly completed: boolean;
}

interface EventActivityItem {
  readonly key: string;
  readonly event: CommunityEvent;
  readonly going: boolean;
}

export function ActivityScreen({ onClose }: ActivityScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  // Each of these is already scoped server-side to the caller's own posts /
  // events / missions (created or joined/completed) and paginated — not the
  // whole community's feed filtered client-side.
  const posts = useMyPosts();
  const comments = useMyComments();
  const events = useMyEventsView();
  const missions = useMyMissionsView();
  const toggleLike = useToggleLike();

  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [openPost, setOpenPost] = useState<ForumPost | null>(null);
  const [openEvent, setOpenEvent] = useState<CommunityEvent | null>(null);
  const [openMission, setOpenMission] = useState<Mission | null>(null);

  // Close the open sheet first and let it slide down, then navigate once
  // the close animation finishes — navigating immediately would unmount the
  // screen (and the sheet with it) mid-animation.
  const closeThenNavigate = (
    path: `/post/${string}` | `/event/${string}` | `/mission/${string}`,
  ) => {
    setOpenPost(null);
    setOpenEvent(null);
    setOpenMission(null);
    setTimeout(() => router.push(path), CLOSE_DURATION);
  };

  const myPosts = useMemo(
    (): readonly ForumPost[] =>
      posts.data?.pages.flatMap((page) => page.posts) ?? [],
    [posts.data],
  );
  const myComments = useMemo(
    (): readonly MyComment[] => comments.data ?? [],
    [comments.data],
  );
  const myEvents = useMemo(
    (): readonly CommunityEvent[] =>
      events.data?.pages.flatMap((page) => page.events) ?? [],
    [events.data],
  );
  const myMissions = useMemo(
    (): readonly Mission[] =>
      missions.data?.pages.flatMap((page) => page.missions) ?? [],
    [missions.data],
  );

  const myPostItems = useMemo((): readonly PostActivityItem[] => {
    const created = myPosts.map(
      (post): PostActivityItem => ({
        createdAt: post.createdAt,
        key: `post-${post.id}`,
        label: KIND_LABEL.post,
        onPress: () => setOpenPost(post),
        subtitle: formatRelativeTime(post.createdAt),
        title: post.title,
      }),
    );
    const commented = myComments.map(
      (comment): PostActivityItem => ({
        createdAt: comment.createdAt,
        key: `comment-${comment.id}`,
        label: COMMENT_LABEL,
        onPress: () => router.push(`/post/${comment.postId}`),
        subtitle: formatRelativeTime(comment.createdAt),
        title: comment.postTitle,
      }),
    );
    return [...created, ...commented].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }, [myPosts, myComments]);
  const myEventItems = useMemo(
    (): readonly EventActivityItem[] =>
      myEvents.map(
        (event): EventActivityItem => ({
          event,
          going: event.author.id !== userId && event.joined,
          key: event.id,
        }),
      ),
    [myEvents, userId],
  );
  const myMissionItems = useMemo(
    (): readonly MissionActivityItem[] =>
      myMissions.map(
        (mission): MissionActivityItem => ({
          completed: mission.status === 'done',
          key: mission.id,
          mission,
        }),
      ),
    [myMissions],
  );

  const isPending =
    posts.isPending || comments.isPending || events.isPending || missions.isPending;
  const hasAnything =
    myPostItems.length > 0 || myEventItems.length > 0 || myMissionItems.length > 0;

  const showPosts = filter === 'all' || filter === 'post';
  const showEvents = filter === 'all' || filter === 'event';
  const showMissions = filter === 'all' || filter === 'mission';

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className="items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Heading className="font-inter-bold" size="xl">
          My Activity
        </Heading>
        <Pressable
          accessibilityLabel="Close"
          className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
          onPress={onClose}
        >
          <Icon name="Close" size={18} />
        </Pressable>
      </HStack>

      {isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="large" />
        </VStack>
      ) : !hasAnything ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="Star" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            Nothing here yet — posts, events, and missions you create will show
            up in one place.
          </Text>
        </VStack>
      ) : (
        <>
          <HStack className="px-5 pb-3" space="sm">
            <StatBox label="Posts" value={myPostItems.length} />
            <StatBox label="Events" value={myEventItems.length} />
            <StatBox label="Missions" value={myMissionItems.length} />
          </HStack>

          <FilterChips active={filter} onSelect={setFilter} />

          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            {showPosts ? (
              <>
                <SectionHeader count={myPostItems.length} title="Posts" />
                {myPostItems.length === 0 ? (
                  <EmptyHint label="You haven't posted or commented in the forum yet." />
                ) : (
                  myPostItems.map((item) => (
                    <ActivityRow
                      key={item.key}
                      kind="post"
                      label={item.label}
                      onPress={item.onPress}
                      subtitle={item.subtitle}
                      title={item.title}
                    />
                  ))
                )}
                {posts.hasNextPage ? (
                  <LoadMoreRow
                    isLoading={posts.isFetchingNextPage}
                    onPress={() => void posts.fetchNextPage()}
                  />
                ) : null}
              </>
            ) : null}

            {showEvents ? (
              <>
                <SectionHeader count={myEventItems.length} title="Events" />
                {myEventItems.length === 0 ? (
                  <EmptyHint label="You haven't created or gone to an event yet." />
                ) : (
                  myEventItems.map(({ event, going, key }) => (
                    <ActivityRow
                      key={key}
                      kind="event"
                      label={going ? EVENT_GOING_LABEL : KIND_LABEL.event}
                      onPress={() => setOpenEvent(event)}
                      subtitle={`${event.dayLabel} ${event.dateLabel} · ${event.timeLabel}`}
                      title={event.title}
                    />
                  ))
                )}
                {events.hasNextPage ? (
                  <LoadMoreRow
                    isLoading={events.isFetchingNextPage}
                    onPress={() => void events.fetchNextPage()}
                  />
                ) : null}
              </>
            ) : null}

            {showMissions ? (
              <>
                <SectionHeader count={myMissionItems.length} title="Missions" />
                {myMissionItems.length === 0 ? (
                  <EmptyHint label="You haven't created or completed a mission yet." />
                ) : (
                  myMissionItems.map(({ completed, key, mission }) => (
                    <ActivityRow
                      key={key}
                      kind="mission"
                      label={completed ? MISSION_COMPLETED_LABEL : KIND_LABEL.mission}
                      onPress={() => setOpenMission(mission)}
                      subtitle={
                        mission.scheduledFor
                          ? formatDateOnly(mission.scheduledFor)
                          : `${mission.stopsDone}/${mission.stopsTotal} stops`
                      }
                      title={mission.title}
                    />
                  ))
                )}
                {missions.hasNextPage ? (
                  <LoadMoreRow
                    isLoading={missions.isFetchingNextPage}
                    onPress={() => void missions.fetchNextPage()}
                  />
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </>
      )}

      <Sheet onClose={() => setOpenPost(null)} visible={openPost !== null}>
        {openPost ? (
          <View className="px-1 pb-4">
            <PostCard
              onOpen={() => closeThenNavigate(`/post/${openPost.id}`)}
              onToggleLike={() =>
                toggleLike.mutate({ forum: openPost.forum, postId: openPost.id })
              }
              post={openPost}
            />
          </View>
        ) : null}
      </Sheet>

      <Sheet onClose={() => setOpenEvent(null)} visible={openEvent !== null}>
        {openEvent ? (
          <EventSummaryCard
            event={openEvent}
            onOpen={(eventId) => closeThenNavigate(`/event/${eventId}`)}
          />
        ) : null}
      </Sheet>

      <Sheet onClose={() => setOpenMission(null)} visible={openMission !== null}>
        {openMission ? (
          <View className="px-1 pb-4">
            <MissionCard
              mission={openMission}
              onOpen={(missionId) => closeThenNavigate(`/mission/${missionId}`)}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

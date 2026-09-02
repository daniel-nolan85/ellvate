import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { formatRelativeTime } from '@/src/lib/relative-time';
import {
  EventSummaryCard,
  type CommunityEvent,
} from '@/src/modules/events';
import { PostCard, useToggleLike, type ForumPost } from '@/src/modules/forum';
import {
  LevelUpCelebrationModal,
  MissionCard,
  MissionCelebrationModal,
  type CheckInCelebration,
  type Mission,
} from '@/src/modules/missions';
import { useMemberProfile } from '@/src/modules/profile';
import {
  SERVICE_CATEGORY_LABEL,
  ServiceListingCard,
  type ServiceListing,
} from '@/src/modules/services';

import {
  ActivityRow,
  EmptyHint,
  FilterChips,
  SectionCard,
  SectionHeader,
  StatBox,
  isActivityFilter,
  type ActivityFilter,
} from './activity-parts';
import { useMemberActivity } from './use-member-activity';

const KIND_LABEL = {
  event: 'Created an event',
  mission: 'Created a mission',
  post: 'Posted in the forum',
  service: 'Listed a service',
} as const;

const COMMENT_LABEL = 'Commented on a post';
const MISSION_COMPLETED_LABEL = 'Completed a mission';
const EVENT_GOING_LABEL = 'Marked going to an event';

interface PostActivityItem {
  readonly key: string;
  readonly createdAt: string;
  readonly title: string;
  readonly label: string;
  readonly subtitle: string;
  readonly onPress: () => void;
}

interface EventActivityItem {
  readonly key: string;
  readonly event: CommunityEvent;
  readonly going: boolean;
}

interface MissionActivityItem {
  readonly key: string;
  readonly mission: Mission;
  readonly completed: boolean;
}

interface ServiceActivityItem {
  readonly key: string;
  readonly listing: ServiceListing;
}

interface MemberActivityScreenProps {
  readonly userId: string;
  readonly loadingName?: string;
  readonly filter?: string;
}

export function MemberActivityScreen({
  filter: filterParam,
  loadingName,
  userId,
}: MemberActivityScreenProps) {
  const insets = useSafeAreaInsets();
  const member = useMemberProfile(userId);
  const activity = useMemberActivity(userId);
  const toggleLike = useToggleLike();
  const displayName = member.data?.profile.name ?? loadingName ?? 'Neighbour';

  const [filter, setFilter] = useState<ActivityFilter>(() =>
    isActivityFilter(filterParam) ? filterParam : 'all',
  );
  const [openPost, setOpenPost] = useState<ForumPost | null>(null);
  const [openEvent, setOpenEvent] = useState<CommunityEvent | null>(null);
  const [openMission, setOpenMission] = useState<Mission | null>(null);
  const [openService, setOpenService] = useState<ServiceListing | null>(null);
  const [celebration, setCelebration] = useState<CheckInCelebration | null>(null);

  const closeThenNavigate = (
    path:
      | `/post/${string}`
      | `/event/${string}`
      | `/mission/${string}`
      | `/service/${string}`,
  ) => {
    setOpenPost(null);
    setOpenEvent(null);
    setOpenMission(null);
    setOpenService(null);
    setTimeout(() => router.push(path), CLOSE_DURATION);
  };

  const postItems = useMemo((): readonly PostActivityItem[] => {
    const created = (activity.data?.posts ?? []).map(
      (post): PostActivityItem => ({
        createdAt: post.createdAt,
        key: `post-${post.id}`,
        label: KIND_LABEL.post,
        onPress: () => setOpenPost(post),
        subtitle: formatRelativeTime(post.createdAt),
        title: post.title,
      }),
    );
    const commented = (activity.data?.comments ?? []).map(
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
  }, [activity.data]);

  const eventItems = useMemo(
    (): readonly EventActivityItem[] =>
      (activity.data?.events ?? []).map(
        (event): EventActivityItem => ({
          event,
          going: event.author.id !== userId && event.joined,
          key: event.id,
        }),
      ),
    [activity.data, userId],
  );

  const missionItems = useMemo(
    (): readonly MissionActivityItem[] =>
      (activity.data?.missions ?? []).map(
        (mission): MissionActivityItem => ({
          completed: mission.status === 'done',
          key: mission.id,
          mission,
        }),
      ),
    [activity.data],
  );

  const serviceItems = useMemo(
    (): readonly ServiceActivityItem[] =>
      (activity.data?.services ?? []).map(
        (listing): ServiceActivityItem => ({ key: listing.id, listing }),
      ),
    [activity.data],
  );

  const hasAnything =
    postItems.length > 0 ||
    eventItems.length > 0 ||
    missionItems.length > 0 ||
    serviceItems.length > 0;

  const showPosts = filter === 'all' || filter === 'post';
  const showEvents = filter === 'all' || filter === 'event';
  const showMissions = filter === 'all' || filter === 'mission';
  const showServices = filter === 'all' || filter === 'service';

  return (
    <View className="flex-1 bg-canvas">
      {/* No manual close button -- this screen is presented as a native
          formSheet (see app/_layout.tsx), whose own grabber, swipe-to-
          dismiss, and tap-outside already cover closing it. A `formSheet`
          page's content starts well below the physical top edge, so this
          only needs a small fixed gap, not insets.top -- unlike Sheet's
          statusBarTranslucent custom Modal, which spans behind the notch. */}
      <HStack className="items-center justify-between px-5 pb-3 pt-3">
        <VStack>
          <Text className="text-text-muted" size="xs">
            Activity
          </Text>
          <Heading className="font-inter-bold" size="xl">
            {displayName}
          </Heading>
        </VStack>
      </HStack>

      {activity.isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="xlarge" />
        </VStack>
      ) : !hasAnything ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="Star" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            {displayName} hasn&apos;t posted, joined an event, or listed
            anything yet.
          </Text>
        </VStack>
      ) : (
        <>
          <HStack className="px-5 pb-3" space="sm">
            <StatBox label="Posts" value={postItems.length} />
            <StatBox label="Events" value={eventItems.length} />
            <StatBox label="Missions" value={missionItems.length} />
            <StatBox label="Services" value={serviceItems.length} />
          </HStack>

          <FilterChips active={filter} onSelect={setFilter} />

          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            {showPosts ? (
              <>
                <SectionHeader count={postItems.length} title="Posts" />
                {postItems.length === 0 ? (
                  <EmptyHint label="No posts or comments yet." />
                ) : (
                  <SectionCard>
                    {postItems.map((item) => (
                      <ActivityRow
                        key={item.key}
                        kind="post"
                        label={item.label}
                        onPress={item.onPress}
                        subtitle={item.subtitle}
                        title={item.title}
                      />
                    ))}
                  </SectionCard>
                )}
              </>
            ) : null}

            {showEvents ? (
              <>
                <SectionHeader count={eventItems.length} title="Events" />
                {eventItems.length === 0 ? (
                  <EmptyHint label="No events created or joined yet." />
                ) : (
                  <SectionCard>
                    {eventItems.map(({ event, going, key }) => (
                      <ActivityRow
                        key={key}
                        kind="event"
                        label={going ? EVENT_GOING_LABEL : KIND_LABEL.event}
                        onPress={() => setOpenEvent(event)}
                        subtitle={`${event.dayLabel} ${event.dateLabel} · ${event.timeLabel}`}
                        title={event.title}
                      />
                    ))}
                  </SectionCard>
                )}
              </>
            ) : null}

            {showMissions ? (
              <>
                <SectionHeader count={missionItems.length} title="Missions" />
                {missionItems.length === 0 ? (
                  <EmptyHint label="No missions created or completed yet." />
                ) : (
                  <SectionCard>
                    {missionItems.map(({ completed, key, mission }) => (
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
                    ))}
                  </SectionCard>
                )}
              </>
            ) : null}

            {showServices ? (
              <>
                <SectionHeader count={serviceItems.length} title="Services" />
                {serviceItems.length === 0 ? (
                  <EmptyHint label="No services listed yet." />
                ) : (
                  <SectionCard>
                    {serviceItems.map(({ key, listing }) => (
                      <ActivityRow
                        key={key}
                        kind="service"
                        label={KIND_LABEL.service}
                        onPress={() => setOpenService(listing)}
                        subtitle={SERVICE_CATEGORY_LABEL[listing.category]}
                        title={listing.businessName}
                      />
                    ))}
                  </SectionCard>
                )}
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
              onMissionComplete={setCelebration}
              onOpen={(missionId) => closeThenNavigate(`/mission/${missionId}`)}
            />
          </View>
        ) : null}
      </Sheet>

      <Sheet onClose={() => setOpenService(null)} visible={openService !== null}>
        {openService ? (
          <View className="px-1 pb-4">
            <ServiceListingCard
              listing={openService}
              onOpen={(listingId) => closeThenNavigate(`/service/${listingId}`)}
            />
          </View>
        ) : null}
      </Sheet>

      <MissionCelebrationModal
        awardedXp={celebration && celebration.leveledUpTo === null ? celebration.awardedXp : null}
        onClose={() => setCelebration(null)}
      />
      <LevelUpCelebrationModal
        newLevel={celebration?.leveledUpTo ?? null}
        onClose={() => setCelebration(null)}
      />
    </View>
  );
}

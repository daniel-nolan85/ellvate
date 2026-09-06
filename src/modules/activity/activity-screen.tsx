import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';

import { ScopedSearchScreen } from '@/src/components/shared/scoped-search-screen';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Icon } from '@/src/components/ui/icon';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { HStack } from '@/src/components/ui/hstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';
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
import {
  LevelUpCelebrationModal,
  MissionCard,
  MissionCelebrationModal,
  useMyMissionsView,
  type CheckInCelebration,
  type Mission,
} from '@/src/modules/missions';
import { PetitionRow, useMyPetitionsView, type Petition } from '@/src/modules/petitions';
import {
  SERVICE_CATEGORY_LABEL,
  ServiceListingCard,
  useMyServiceListingsView,
  type ServiceListing,
} from '@/src/modules/services';
import { useSession } from '@/src/platform/session';

import {
  ActivityRow,
  EmptyHint,
  FilterChips,
  LoadMoreFooter,
  SectionCard,
  SectionHeader,
  StatBox,
  isActivityFilter,
  ALL_FILTER_PREVIEW_COUNT,
  type ActivityFilter,
} from './activity-parts';

const KIND_LABEL = {
  event: 'You created an event',
  mission: 'You created a mission',
  petition: 'You started a petition',
  post: 'You created a post',
  service: 'You listed a service',
} as const;

const COMMENT_LABEL = 'You commented on a post';
const MISSION_COMPLETED_LABEL = 'You completed a mission';
const EVENT_GOING_LABEL = 'You marked going to an event';
const PETITION_SIGNED_LABEL = 'You signed a petition';

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

interface ServiceActivityItem {
  readonly key: string;
  readonly listing: ServiceListing;
}

interface PetitionActivityItem {
  readonly key: string;
  readonly petition: Petition;
  readonly signedOnly: boolean;
}

interface SearchableActivityItem {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly onSelect: () => void;
}

export function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();

  // Each of these is already scoped server-side to the caller's own posts /
  // events / missions (created or joined/completed) and paginated — not the
  // whole community's feed filtered client-side.
  const posts = useMyPosts();
  const comments = useMyComments();
  const events = useMyEventsView();
  const missions = useMyMissionsView();
  const services = useMyServiceListingsView();
  const petitions = useMyPetitionsView();
  const toggleLike = useToggleLike();

  // Lets a link (e.g. a tappable stat on the profile screen) land directly
  // on one section — /activity?filter=event — instead of always opening on
  // "All". Only read once on mount: this screen owns `filter` afterward, so
  // the chips stay responsive rather than snapping back if the param is
  // still present on a later re-render.
  const [filter, setFilter] = useState<ActivityFilter>(() =>
    isActivityFilter(filterParam) ? filterParam : 'all',
  );
  const [openPost, setOpenPost] = useState<ForumPost | null>(null);
  const [openEvent, setOpenEvent] = useState<CommunityEvent | null>(null);
  const [openMission, setOpenMission] = useState<Mission | null>(null);
  const [openService, setOpenService] = useState<ServiceListing | null>(null);
  const [openPetition, setOpenPetition] = useState<Petition | null>(null);
  const [celebration, setCelebration] = useState<CheckInCelebration | null>(null);

  // Close the open sheet first and let it slide down, then navigate once
  // the close animation finishes — navigating immediately would unmount the
  // screen (and the sheet with it) mid-animation.
  const closeThenNavigate = (
    path:
      | `/post/${string}`
      | `/event/${string}`
      | `/mission/${string}`
      | `/service/${string}`
      | `/petition/${string}`,
  ) => {
    setOpenPost(null);
    setOpenEvent(null);
    setOpenMission(null);
    setOpenService(null);
    setOpenPetition(null);
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
  const myServiceListings = useMemo(
    (): readonly ServiceListing[] =>
      services.data?.pages.flatMap((page) => page.listings) ?? [],
    [services.data],
  );
  const myPetitionsList = useMemo(
    (): readonly Petition[] =>
      petitions.data?.pages.flatMap((page) => page.petitions) ?? [],
    [petitions.data],
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

  const myServiceItems = useMemo(
    (): readonly ServiceActivityItem[] =>
      myServiceListings.map(
        (listing): ServiceActivityItem => ({ key: listing.id, listing }),
      ),
    [myServiceListings],
  );

  const myPetitionItems = useMemo(
    (): readonly PetitionActivityItem[] =>
      myPetitionsList.map(
        (petition): PetitionActivityItem => ({
          key: petition.id,
          petition,
          signedOnly: petition.createdBy.id !== userId && petition.signed,
        }),
      ),
    [myPetitionsList, userId],
  );

  const isPending =
    posts.isPending ||
    comments.isPending ||
    events.isPending ||
    missions.isPending ||
    services.isPending ||
    petitions.isPending;
  const hasAnything =
    myPostItems.length > 0 ||
    myEventItems.length > 0 ||
    myMissionItems.length > 0 ||
    myServiceItems.length > 0 ||
    myPetitionItems.length > 0;

  // Deferred, not `filter` directly. A diagnostic build (9th attempt) proved
  // the actual mechanism directly rather than guessing at it: with "All"'s
  // section list replaced by a static placeholder -- so literally nothing
  // else mounted alongside the pills -- the pills rendered perfectly on the
  // same device that had reproduced the corruption every time before. So
  // it's confirmed, not theorized: the pills corrupt because up to five
  // SectionCards commit to native in the exact same pass as this row.
  //
  // Two prior attempts at deferring that commit (requestAnimationFrame,
  // then InteractionManager.runAfterInteractions) both made no on-device
  // difference at all, confirmed against the exact shipped code each time.
  // Both share the same flaw: they're "run on the next available idle
  // moment" primitives, not real elapsed-time guarantees. rAF ties to the
  // next vsync, which React 18's automatic batching (and Fabric's own
  // commit scheduling) can still fold into the same native commit as
  // whatever's already pending. InteractionManager only waits if something
  // has registered an active interaction handle via
  // InteractionManager.createInteractionHandle() -- nothing anywhere in
  // this codebase ever does, so its queue is always empty and it fires
  // essentially immediately, no more separated than rAF was.
  //
  // A plain setTimeout with a real, non-zero delay is the one primitive
  // here that forces the JS thread to actually yield for a measured amount
  // of wall-clock time, guaranteeing the pills' own commit has long since
  // reached the screen before the heavy section content is even scheduled.
  const [deferredFilter, setDeferredFilter] = useState<ActivityFilter | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => setDeferredFilter(filter), 100);
    return () => clearTimeout(timeout);
  }, [filter]);
  const isAllPreview = deferredFilter === 'all';
  const showPosts = deferredFilter === 'all' || deferredFilter === 'post';
  const showEvents = deferredFilter === 'all' || deferredFilter === 'event';
  const showMissions = deferredFilter === 'all' || deferredFilter === 'mission';
  const showServices = deferredFilter === 'all' || deferredFilter === 'service';
  const showPetitions = deferredFilter === 'all' || deferredFilter === 'petition';

  // Reaching the bottom of the shared ScrollView loads the next page of
  // every currently-visible section at once, rather than trying to detect
  // which individual section the user scrolled past.
  const onScroll = useLoadMoreOnScroll([
    ...(showPosts
      ? [{ fetchNextPage: posts.fetchNextPage, hasNextPage: posts.hasNextPage, isFetchingNextPage: posts.isFetchingNextPage }]
      : []),
    ...(showEvents
      ? [{ fetchNextPage: events.fetchNextPage, hasNextPage: events.hasNextPage, isFetchingNextPage: events.isFetchingNextPage }]
      : []),
    ...(showMissions
      ? [{ fetchNextPage: missions.fetchNextPage, hasNextPage: missions.hasNextPage, isFetchingNextPage: missions.isFetchingNextPage }]
      : []),
    ...(showServices
      ? [{ fetchNextPage: services.fetchNextPage, hasNextPage: services.hasNextPage, isFetchingNextPage: services.isFetchingNextPage }]
      : []),
    ...(showPetitions
      ? [{ fetchNextPage: petitions.fetchNextPage, hasNextPage: petitions.hasNextPage, isFetchingNextPage: petitions.isFetchingNextPage }]
      : []),
  ]);

  const [isSearching, setIsSearching] = useState(false);
  const searchItems = useMemo(
    (): readonly SearchableActivityItem[] => [
      ...myPostItems.map(
        (item): SearchableActivityItem => ({
          key: item.key,
          onSelect: item.onPress,
          subtitle: item.label,
          title: item.title,
        }),
      ),
      ...myEventItems.map(
        ({ event, key }): SearchableActivityItem => ({
          key,
          onSelect: () => setOpenEvent(event),
          subtitle: `${event.dayLabel} ${event.dateLabel}`,
          title: event.title,
        }),
      ),
      ...myMissionItems.map(
        ({ key, mission }): SearchableActivityItem => ({
          key,
          onSelect: () => setOpenMission(mission),
          subtitle: KIND_LABEL.mission,
          title: mission.title,
        }),
      ),
      ...myServiceItems.map(
        ({ key, listing }): SearchableActivityItem => ({
          key,
          onSelect: () => setOpenService(listing),
          subtitle: KIND_LABEL.service,
          title: listing.businessName,
        }),
      ),
      ...myPetitionItems.map(
        ({ key, petition }): SearchableActivityItem => ({
          key,
          onSelect: () => setOpenPetition(petition),
          subtitle: KIND_LABEL.petition,
          title: petition.title,
        }),
      ),
    ],
    [myPostItems, myEventItems, myMissionItems, myServiceItems, myPetitionItems],
  );

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ paddingTop: insets.top }}>
        <ScreenTitle
          eyebrow="Your history"
          onSearch={() => setIsSearching(true)}
          title="My Activity"
        />
      </View>

      {isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="xlarge" />
        </VStack>
      ) : !hasAnything ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="Star" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            Nothing here yet — posts, events, missions, services, and
            petitions you create will show up in one place.
          </Text>
        </VStack>
      ) : (
        <>
          {/* collapsable={false}: the same real react-native-screens#3092
              view-flattening workaround used on four other screens in this
              app (see e.g. notifications-screen.tsx) -- kept here as a
              defensive measure against that class of bug, though the pills
              row's own "smushed on All" report is addressed instead by
              deferredFilter above, forcing the 1-to-5-section ScrollView
              below to commit to native strictly one frame after this row. */}
          <HStack className="px-5 pb-3" collapsable={false} space="sm">
            <StatBox label="Posts" value={myPostItems.length} />
            <StatBox label="Events" value={myEventItems.length} />
            <StatBox label="Missions" value={myMissionItems.length} />
            <StatBox label="Services" value={myServiceItems.length} />
            <StatBox label="Petitions" value={myPetitionItems.length} />
          </HStack>

          <FilterChips active={filter} onSelect={setFilter} />

          <ScrollView
            contentContainerStyle={{ paddingBottom: 130 }}
            onScroll={onScroll}
            scrollEventThrottle={100}
          >
            {/* "All" previews at most ALL_FILTER_PREVIEW_COUNT rows per
                section instead of every row from all 5 sources at once --
                see activity-parts.tsx's ALL_FILTER_PREVIEW_COUNT. Reduces
                how much this ScrollView mounts at once, independent of (and
                on top of) the deferredFilter commit-splitting above, which
                is what actually addresses the pills' own corruption. */}
            {showPosts ? (
              <>
                <SectionHeader
                  count={myPostItems.length}
                  onSeeAll={
                    isAllPreview && myPostItems.length > ALL_FILTER_PREVIEW_COUNT
                      ? () => setFilter('post')
                      : undefined
                  }
                  title="Posts"
                />
                {myPostItems.length === 0 ? (
                  <EmptyHint label="You haven't posted or commented in the forum yet." />
                ) : (
                  <SectionCard>
                    {(isAllPreview ? myPostItems.slice(0, ALL_FILTER_PREVIEW_COUNT) : myPostItems).map(
                      (item) => (
                        <ActivityRow
                          key={item.key}
                          kind="post"
                          label={item.label}
                          onPress={item.onPress}
                          subtitle={item.subtitle}
                          title={item.title}
                        />
                      ),
                    )}
                    {isAllPreview ? null : (
                      <LoadMoreFooter isLoading={posts.isFetchingNextPage} />
                    )}
                  </SectionCard>
                )}
              </>
            ) : null}

            {showEvents ? (
              <>
                <SectionHeader
                  count={myEventItems.length}
                  onSeeAll={
                    isAllPreview && myEventItems.length > ALL_FILTER_PREVIEW_COUNT
                      ? () => setFilter('event')
                      : undefined
                  }
                  title="Events"
                />
                {myEventItems.length === 0 ? (
                  <EmptyHint label="You haven't created or gone to an event yet." />
                ) : (
                  <SectionCard>
                    {(isAllPreview ? myEventItems.slice(0, ALL_FILTER_PREVIEW_COUNT) : myEventItems).map(
                      ({ event, going, key }) => (
                        <ActivityRow
                          key={key}
                          kind="event"
                          label={going ? EVENT_GOING_LABEL : KIND_LABEL.event}
                          onPress={() => setOpenEvent(event)}
                          subtitle={`${event.dayLabel} ${event.dateLabel} · ${event.timeLabel}`}
                          title={event.title}
                        />
                      ),
                    )}
                    {isAllPreview ? null : (
                      <LoadMoreFooter isLoading={events.isFetchingNextPage} />
                    )}
                  </SectionCard>
                )}
              </>
            ) : null}

            {showMissions ? (
              <>
                <SectionHeader
                  count={myMissionItems.length}
                  onSeeAll={
                    isAllPreview && myMissionItems.length > ALL_FILTER_PREVIEW_COUNT
                      ? () => setFilter('mission')
                      : undefined
                  }
                  title="Missions"
                />
                {myMissionItems.length === 0 ? (
                  <EmptyHint label="You haven't created or completed a mission yet." />
                ) : (
                  <SectionCard>
                    {(isAllPreview
                      ? myMissionItems.slice(0, ALL_FILTER_PREVIEW_COUNT)
                      : myMissionItems
                    ).map(({ completed, key, mission }) => (
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
                    {isAllPreview ? null : (
                      <LoadMoreFooter isLoading={missions.isFetchingNextPage} />
                    )}
                  </SectionCard>
                )}
              </>
            ) : null}

            {showServices ? (
              <>
                <SectionHeader
                  count={myServiceItems.length}
                  onSeeAll={
                    isAllPreview && myServiceItems.length > ALL_FILTER_PREVIEW_COUNT
                      ? () => setFilter('service')
                      : undefined
                  }
                  title="Services"
                />
                {myServiceItems.length === 0 ? (
                  <EmptyHint label="You haven't listed a service yet." />
                ) : (
                  <SectionCard>
                    {(isAllPreview
                      ? myServiceItems.slice(0, ALL_FILTER_PREVIEW_COUNT)
                      : myServiceItems
                    ).map(({ key, listing }) => (
                      <ActivityRow
                        key={key}
                        kind="service"
                        label={KIND_LABEL.service}
                        onPress={() => setOpenService(listing)}
                        subtitle={SERVICE_CATEGORY_LABEL[listing.category]}
                        title={listing.businessName}
                      />
                    ))}
                    {isAllPreview ? null : (
                      <LoadMoreFooter isLoading={services.isFetchingNextPage} />
                    )}
                  </SectionCard>
                )}
              </>
            ) : null}

            {showPetitions ? (
              <>
                <SectionHeader
                  count={myPetitionItems.length}
                  onSeeAll={
                    isAllPreview && myPetitionItems.length > ALL_FILTER_PREVIEW_COUNT
                      ? () => setFilter('petition')
                      : undefined
                  }
                  title="Petitions"
                />
                {myPetitionItems.length === 0 ? (
                  <EmptyHint label="You haven't started or signed a petition yet." />
                ) : (
                  <SectionCard>
                    {(isAllPreview
                      ? myPetitionItems.slice(0, ALL_FILTER_PREVIEW_COUNT)
                      : myPetitionItems
                    ).map(({ key, petition, signedOnly }) => (
                      <ActivityRow
                        key={key}
                        kind="petition"
                        label={signedOnly ? PETITION_SIGNED_LABEL : KIND_LABEL.petition}
                        onPress={() => setOpenPetition(petition)}
                        subtitle={`${petition.signatureCount} of ${petition.requiredSignatures} signatures`}
                        title={petition.title}
                      />
                    ))}
                    {isAllPreview ? null : (
                      <LoadMoreFooter isLoading={petitions.isFetchingNextPage} />
                    )}
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

      <Sheet onClose={() => setOpenPetition(null)} visible={openPetition !== null}>
        {openPetition ? (
          <View className="px-4 pb-4">
            <PetitionRow
              onOpen={(petitionId) => closeThenNavigate(`/petition/${petitionId}`)}
              petition={openPetition}
            />
          </View>
        ) : null}
      </Sheet>

      <ScopedSearchScreen
        getKey={(item) => item.key}
        getSubtitle={(item) => item.subtitle}
        getTitle={(item) => item.title}
        items={searchItems}
        onClose={() => setIsSearching(false)}
        onSelect={(item) => item.onSelect()}
        placeholder="Search your activity"
        visible={isSearching}
      />

      <CommunityNavBar />

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

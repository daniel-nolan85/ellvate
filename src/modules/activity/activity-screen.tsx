import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';

import { ScopedSearchScreen } from '@/src/components/shared/scoped-search-screen';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { CactusMascot, Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
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
  ActivitySectionList,
  ActivityStatPanel,
  FilterChips,
  isActivityFilter,
  type ActivityFilter,
  type ActivityListItem,
  type ActivityLoadMoreTarget,
  type ActivitySection,
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
  // Posts. Only read once on mount: this screen owns `filter` afterward, so
  // the chips stay responsive rather than snapping back if the param is
  // still present on a later re-render.
  const [filter, setFilter] = useState<ActivityFilter>(() =>
    isActivityFilter(filterParam) ? filterParam : 'post',
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

  // Flattened to one shared shape for ActivitySectionList (see
  // activity-parts.tsx) -- each of the 5 sources above carries its own
  // typed entity plus a couple of flags, but the list only ever needs to
  // render a title/label/subtitle/press-handler regardless of which kind
  // of thing it is.
  const myPostListItems = useMemo(
    (): readonly ActivityListItem[] =>
      myPostItems.map(
        (item): ActivityListItem => ({
          key: item.key,
          kind: 'post',
          label: item.label,
          onPress: item.onPress,
          subtitle: item.subtitle,
          title: item.title,
        }),
      ),
    [myPostItems],
  );
  const myEventListItems = useMemo(
    (): readonly ActivityListItem[] =>
      myEventItems.map(
        ({ event, going, key }): ActivityListItem => ({
          key,
          kind: 'event',
          label: going ? EVENT_GOING_LABEL : KIND_LABEL.event,
          onPress: () => setOpenEvent(event),
          subtitle: `${event.dayLabel} ${event.dateLabel} · ${event.timeLabel}`,
          title: event.title,
        }),
      ),
    [myEventItems],
  );
  const myMissionListItems = useMemo(
    (): readonly ActivityListItem[] =>
      myMissionItems.map(
        ({ completed, key, mission }): ActivityListItem => ({
          key,
          kind: 'mission',
          label: completed ? MISSION_COMPLETED_LABEL : KIND_LABEL.mission,
          onPress: () => setOpenMission(mission),
          subtitle: mission.scheduledFor
            ? formatDateOnly(mission.scheduledFor)
            : `${mission.stopsDone}/${mission.stopsTotal} stops`,
          title: mission.title,
        }),
      ),
    [myMissionItems],
  );
  const myServiceListItems = useMemo(
    (): readonly ActivityListItem[] =>
      myServiceItems.map(
        ({ key, listing }): ActivityListItem => ({
          key,
          kind: 'service',
          label: KIND_LABEL.service,
          onPress: () => setOpenService(listing),
          subtitle: SERVICE_CATEGORY_LABEL[listing.category],
          title: listing.businessName,
        }),
      ),
    [myServiceItems],
  );
  const myPetitionListItems = useMemo(
    (): readonly ActivityListItem[] =>
      myPetitionItems.map(
        ({ key, petition, signedOnly }): ActivityListItem => ({
          key,
          kind: 'petition',
          label: signedOnly ? PETITION_SIGNED_LABEL : KIND_LABEL.petition,
          onPress: () => setOpenPetition(petition),
          subtitle: `${petition.signatureCount} of ${petition.requiredSignatures} signatures`,
          title: petition.title,
        }),
      ),
    [myPetitionItems],
  );

  const isPending =
    posts.isPending ||
    comments.isPending ||
    events.isPending ||
    missions.isPending ||
    services.isPending ||
    petitions.isPending;
  // Refreshes every kind together, not just the active filter -- switching
  // filters shows already-fetched data instantly, so a stale filter you
  // haven't looked at yet would otherwise never get pulled fresh.
  const isRefreshing =
    posts.isRefetching ||
    comments.isRefetching ||
    events.isRefetching ||
    missions.isRefetching ||
    services.isRefetching ||
    petitions.isRefetching;
  const refreshAll = () => {
    void posts.refetch();
    void comments.refetch();
    void events.refetch();
    void missions.refetch();
    void services.refetch();
    void petitions.refetch();
  };
  const hasAnything =
    myPostItems.length > 0 ||
    myEventItems.length > 0 ||
    myMissionItems.length > 0 ||
    myServiceItems.length > 0 ||
    myPetitionItems.length > 0;

  // Splits the two stats that used to be a single ambiguous combined count
  // (an "Events" or "Missions" number that could mean created, attended, or
  // both) into their own figures. Events created/attending are mutually
  // exclusive by construction (see the `going` flag above, which already
  // excludes the item's own author) -- Missions created/completed are not
  // (a mission you made and later completed yourself counts toward both),
  // matching how the rest of the app already tracks these independently
  // (see PublicMemberStats).
  const eventsCreatedCount = myEventItems.filter(
    (item) => item.event.author.id === userId,
  ).length;
  const eventsAttendingCount = myEventItems.filter((item) => item.going).length;
  const missionsCreatedCount = myMissionItems.filter(
    (item) => item.mission.author.id === userId,
  ).length;
  const missionsCompletedCount = myMissionItems.filter(
    (item) => item.completed,
  ).length;

  // ActivitySectionList (see activity-parts.tsx) always renders exactly one
  // section here -- there's no "All" filter combining several at once (see
  // FILTERS in activity-parts.tsx for why) -- and it actually virtualizes,
  // so only the rows on screen exist as real native views no matter how
  // large this one list grows.
  const sections = useMemo((): readonly ActivitySection[] => {
    const activeSection: { readonly title: string; readonly items: readonly ActivityListItem[]; readonly emptyLabel: string } =
      filter === 'post'
        ? { emptyLabel: "You haven't posted or commented in the forum yet.", items: myPostListItems, title: 'Posts' }
        : filter === 'event'
          ? { emptyLabel: "You haven't created or gone to an event yet.", items: myEventListItems, title: 'Events' }
          : filter === 'mission'
            ? {
                emptyLabel: "You haven't created or completed a mission yet.",
                items: myMissionListItems,
                title: 'Missions',
              }
            : filter === 'service'
              ? { emptyLabel: "You haven't listed a service yet.", items: myServiceListItems, title: 'Services' }
              : {
                  emptyLabel: "You haven't started or signed a petition yet.",
                  items: myPetitionListItems,
                  title: 'Petitions',
                };
    return [
      {
        count: activeSection.items.length,
        data: activeSection.items,
        emptyLabel: activeSection.emptyLabel,
        key: filter,
        title: activeSection.title,
      },
    ];
  }, [
    filter,
    myPostListItems,
    myEventListItems,
    myMissionListItems,
    myServiceListItems,
    myPetitionListItems,
  ]);

  const loadMore: ActivityLoadMoreTarget =
    filter === 'post'
      ? posts
      : filter === 'event'
        ? events
        : filter === 'mission'
          ? missions
          : filter === 'service'
            ? services
            : petitions;

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
        // CactusMascot, not Icon -- the first theming-pass empty state to try
        // the app's own dancing-cactus glyph (see Spinner) standing still as
        // a brand mascot rather than a generic icon. Static (animated left
        // off, its default) since this is "genuinely nothing here yet," not
        // "still loading" -- a dancing cactus in an empty state would send
        // the wrong signal.
        <VStack className="items-center gap-3 px-8 py-16" space="sm">
          <CactusMascot size={64} />
          <Text className="text-center text-[14px] text-text-muted">
            Nothing here yet — posts, events, missions, services, and
            petitions you create will show up in one place.
          </Text>
        </VStack>
      ) : (
        <>
          {/* collapsable={false}: the same real react-native-screens#3092
              view-flattening workaround used on four other screens in this
              app (see e.g. notifications-screen.tsx). Shows only the 1-2
              cards relevant to the active filter tab below, not every kind
              at once -- see ActivityStatPanel's own WHY. */}
          <View collapsable={false}>
            <ActivityStatPanel
              eventsAttendingCount={eventsAttendingCount}
              eventsCreatedCount={eventsCreatedCount}
              filter={filter}
              missionsCompletedCount={missionsCompletedCount}
              missionsCreatedCount={missionsCreatedCount}
              missionsEngagedCount={myMissionItems.length}
              petitionsCount={myPetitionItems.length}
              postsCount={myPostItems.length}
              servicesCount={myServiceItems.length}
            />
          </View>

          <FilterChips active={filter} onSelect={setFilter} />

          <ActivitySectionList
            contentContainerStyle={{ paddingBottom: 130 }}
            loadMore={loadMore}
            onRefresh={refreshAll}
            refreshing={isRefreshing}
            sections={sections}
          />
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

import { useMemo, useState } from 'react';
import { View } from 'react-native';
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
  RankUpCelebrationModal,
  type CheckInCelebration,
  type Mission,
} from '@/src/modules/missions';
import { PetitionRow, type Petition } from '@/src/modules/petitions';
import { useMemberProfile } from '@/src/modules/profile';
import {
  SERVICE_CATEGORY_LABEL,
  ServiceListingCard,
  type ServiceListing,
} from '@/src/modules/services';

import {
  ActivitySectionList,
  FilterChips,
  StatBox,
  isActivityFilter,
  type ActivityFilter,
  type ActivityListItem,
  type ActivitySection,
} from './activity-parts';
import { useMemberActivity } from './use-member-activity';

const KIND_LABEL = {
  event: 'Created an event',
  mission: 'Created a mission',
  petition: 'Started a petition',
  post: 'Posted in the forum',
  service: 'Listed a service',
} as const;

const COMMENT_LABEL = 'Commented on a post';
const MISSION_COMPLETED_LABEL = 'Completed a mission';
const EVENT_GOING_LABEL = 'Marked going to an event';
const PETITION_SIGNED_LABEL = 'Signed a petition';

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

interface PetitionActivityItem {
  readonly key: string;
  readonly petition: Petition;
  readonly signedOnly: boolean;
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
    isActivityFilter(filterParam) ? filterParam : 'post',
  );
  const [openPost, setOpenPost] = useState<ForumPost | null>(null);
  const [openEvent, setOpenEvent] = useState<CommunityEvent | null>(null);
  const [openMission, setOpenMission] = useState<Mission | null>(null);
  const [openService, setOpenService] = useState<ServiceListing | null>(null);
  const [openPetition, setOpenPetition] = useState<Petition | null>(null);
  const [celebration, setCelebration] = useState<CheckInCelebration | null>(null);

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

  const petitionItems = useMemo(
    (): readonly PetitionActivityItem[] =>
      (activity.data?.petitions ?? []).map(
        (petition): PetitionActivityItem => ({
          key: petition.id,
          petition,
          signedOnly: petition.createdBy.id !== userId && petition.signed,
        }),
      ),
    [activity.data, userId],
  );

  // Flattened to one shared shape for ActivitySectionList (see
  // activity-parts.tsx and its identical use in activity-screen.tsx) --
  // each of the 5 sources above carries its own typed entity plus a couple
  // of flags, but the list only ever needs a title/label/subtitle/press-
  // handler regardless of which kind of thing it is.
  const postListItems = useMemo(
    (): readonly ActivityListItem[] =>
      postItems.map(
        (item): ActivityListItem => ({
          key: item.key,
          kind: 'post',
          label: item.label,
          onPress: item.onPress,
          subtitle: item.subtitle,
          title: item.title,
        }),
      ),
    [postItems],
  );
  const eventListItems = useMemo(
    (): readonly ActivityListItem[] =>
      eventItems.map(
        ({ event, going, key }): ActivityListItem => ({
          key,
          kind: 'event',
          label: going ? EVENT_GOING_LABEL : KIND_LABEL.event,
          onPress: () => setOpenEvent(event),
          subtitle: `${event.dayLabel} ${event.dateLabel} · ${event.timeLabel}`,
          title: event.title,
        }),
      ),
    [eventItems],
  );
  const missionListItems = useMemo(
    (): readonly ActivityListItem[] =>
      missionItems.map(
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
    [missionItems],
  );
  const serviceListItems = useMemo(
    (): readonly ActivityListItem[] =>
      serviceItems.map(
        ({ key, listing }): ActivityListItem => ({
          key,
          kind: 'service',
          label: KIND_LABEL.service,
          onPress: () => setOpenService(listing),
          subtitle: SERVICE_CATEGORY_LABEL[listing.category],
          title: listing.businessName,
        }),
      ),
    [serviceItems],
  );
  const petitionListItems = useMemo(
    (): readonly ActivityListItem[] =>
      petitionItems.map(
        ({ key, petition, signedOnly }): ActivityListItem => ({
          key,
          kind: 'petition',
          label: signedOnly ? PETITION_SIGNED_LABEL : KIND_LABEL.petition,
          onPress: () => setOpenPetition(petition),
          subtitle: `${petition.signatureCount} of ${petition.requiredSignatures} signatures`,
          title: petition.title,
        }),
      ),
    [petitionItems],
  );

  const hasAnything =
    postItems.length > 0 ||
    eventItems.length > 0 ||
    missionItems.length > 0 ||
    serviceItems.length > 0 ||
    petitionItems.length > 0;

  // ActivitySectionList (see activity-parts.tsx) always renders exactly one
  // section here -- there's no "All" filter combining several at once (see
  // FILTERS in activity-parts.tsx for why) -- and it actually virtualizes,
  // so only the rows on screen exist as real native views no matter how
  // large this one list grows.
  const sections = useMemo((): readonly ActivitySection[] => {
    const activeSection: { readonly title: string; readonly items: readonly ActivityListItem[]; readonly emptyLabel: string } =
      filter === 'post'
        ? { emptyLabel: 'No posts or comments yet.', items: postListItems, title: 'Posts' }
        : filter === 'event'
          ? { emptyLabel: 'No events created or joined yet.', items: eventListItems, title: 'Events' }
          : filter === 'mission'
            ? {
                emptyLabel: 'No missions created or completed yet.',
                items: missionListItems,
                title: 'Missions',
              }
            : filter === 'service'
              ? { emptyLabel: 'No services listed yet.', items: serviceListItems, title: 'Services' }
              : {
                  emptyLabel: 'No petitions started or signed yet.',
                  items: petitionListItems,
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
  }, [filter, postListItems, eventListItems, missionListItems, serviceListItems, petitionListItems]);

  return (
    // Always presented as a native modal (see below), so `flex-1` on this
    // root is not a reliable way to fill the sheet's allocated height --
    // see SHEET_SCREEN_OPTIONS'/MODAL_SCREEN_OPTIONS' own WHY (community-
    // shell) for the underlying react-native-screens quirk; contentStyle:
    // {height:'100%'} there fixes the *navigator's* wrapper, but this
    // component's own root also needs an explicit height rather than flex
    // to actually stretch to match it. collapsable={false} on this root
    // (not just the header below) keeps it from being flattened into that
    // wrapper by RN's view-flattening optimization -- the same #3092 class
    // of bug the header fix below targets, but at the container level.
    <View className="bg-canvas" collapsable={false} style={{ height: '100%' }}>
      {/* No manual close button -- this screen is presented as a native
          `presentation: 'modal'` screen (see app/_layout.tsx and
          MODAL_SCREEN_OPTIONS -- not formSheet like Member Profile, the
          screen this one is always reached from, specifically to dodge
          react-native-screens#3569, a formSheet-presented-over-another-
          formSheet content-height bug this screen used to trigger every
          time a stat card was tapped), whose own swipe-to-dismiss and
          tap-outside already cover closing it. Like formSheet, this still
          presents as an inset page sheet rather than flush with the
          physical top edge, so a small fixed gap is enough here too, not
          insets.top -- unlike Sheet's statusBarTranslucent custom Modal,
          which spans behind the notch. collapsable={false} works around a
          real react-native-screens bug (software-mansion/react-native-
          screens#3092): a screen whose root View has a background color
          can have RN's view-flattening optimization collapse this header's
          native view into its parent, which then lets the ScrollView below
          render on top of it instead of below it -- forcing this view to
          actually exist natively is the documented fix. */}
      {/* pt-9, not this app's usual pt-6 -- see digest-screen.tsx's identical
          WHY: the native grabber/rounded top corner of this modal
          presentation already take up real space above the first row, so
          the same fixed gap that reads fine on a plain pushed screen's
          header reads as cramped here specifically. */}
      <HStack className="items-center justify-between px-5 pb-3 pt-9" collapsable={false}>
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
            {displayName} hasn&apos;t posted, joined an event, listed
            anything, or started a petition yet.
          </Text>
        </VStack>
      ) : (
        <>
          {/* collapsable={false}: same fix, same reasoning as
              activity-screen.tsx's identical stat-box row (see its own
              comment). */}
          <HStack className="px-5 pb-3" collapsable={false} space="sm">
            <StatBox label="Posts" value={postItems.length} />
            <StatBox label="Events" value={eventItems.length} />
            <StatBox label="Missions" value={missionItems.length} />
            <StatBox label="Services" value={serviceItems.length} />
            <StatBox label="Petitions" value={petitionItems.length} />
          </HStack>

          <FilterChips active={filter} onSelect={setFilter} />

          <ActivitySectionList
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            onRefresh={() => {
              void activity.refetch();
              void member.refetch();
            }}
            refreshing={activity.isRefetching || member.isRefetching}
            sections={sections}
          />
        </>
      )}

      <Sheet onClose={() => setOpenPost(null)} visible={openPost !== null}>
        {openPost ? (
          <View className="px-1 pb-4">
            <PostCard
              onOpen={(focusComments) =>
                closeThenNavigate(
                  `/post/${openPost.id}${focusComments ? '?focusComments=1' : ''}`,
                )
              }
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

      <MissionCelebrationModal
        awardedXp={celebration && celebration.leveledUpTo === null ? celebration.awardedXp : null}
        onClose={() => setCelebration(null)}
      />
      <LevelUpCelebrationModal
        newLevel={celebration?.rankedUpTo ? null : (celebration?.leveledUpTo ?? null)}
        onClose={() => setCelebration(null)}
        title={celebration?.title ?? ''}
      />
      <RankUpCelebrationModal
        newTitle={celebration?.rankedUpTo ?? null}
        onClose={() => setCelebration(null)}
      />
    </View>
  );
}

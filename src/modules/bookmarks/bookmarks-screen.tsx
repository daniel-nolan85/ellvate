import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router, type Href } from 'expo-router';

import { SearchSheet } from '@/src/components/shared/search-sheet';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';
import { EventSummaryCard } from '@/src/modules/events';
import { PostCard, useToggleLike } from '@/src/modules/forum';
import {
  LevelUpCelebrationModal,
  MissionCard,
  MissionCelebrationModal,
  type CheckInCelebration,
} from '@/src/modules/missions';
import { PetitionRow } from '@/src/modules/petitions';
import { ServiceListingCard } from '@/src/modules/services';

import { useBookmarks, type BookmarkedItem, type BookmarkTargetType } from './use-bookmarks';

type BookmarksFilter = 'all' | BookmarkTargetType;

const KIND_ICON: Readonly<Record<BookmarkTargetType, AppIconName>> = {
  event: 'CalendarDays',
  mission: 'Star',
  petition: 'FileSignature',
  post: 'MessageCircle',
  service: 'Store',
};

const KIND_LABEL: Readonly<Record<BookmarkTargetType, string>> = {
  event: 'Bookmarked event',
  mission: 'Bookmarked mission',
  petition: 'Bookmarked petition',
  post: 'Bookmarked post',
  service: 'Bookmarked listing',
};

const FILTERS: readonly { readonly key: BookmarksFilter; readonly label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'post', label: 'Posts' },
  { key: 'event', label: 'Events' },
  { key: 'mission', label: 'Missions' },
  { key: 'service', label: 'Services' },
  { key: 'petition', label: 'Petitions' },
];

// The API/backend model a bookmark list as one unified, server-paginated
// stream (not three parallel per-type feeds like the activity hub), so the
// filter is passed straight through to useBookmarks rather than fetching
// everything and slicing client-side.
function filterToTargetType(filter: BookmarksFilter): BookmarkTargetType | undefined {
  return filter === 'all' ? undefined : filter;
}

function FilterChips({
  active,
  onSelect,
}: {
  readonly active: BookmarksFilter;
  readonly onSelect: (filter: BookmarksFilter) => void;
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
              isActive ? 'bg-accent' : 'bg-secondary'
            }`}
            // key includes `active`: see activity-parts.tsx's FilterChips
            // (kept identical) for why -- forces every pill to remount on
            // each filter change instead of restyling in place.
            key={`${filter.key}-${active}`}
            onPress={() => onSelect(filter.key)}
          >
            {/* allowFontScaling={false}: see activity-parts.tsx's FilterChips
                (kept identical) -- a fixed leading-[18px] clipped these
                glyphs' tops on a device with a larger OS text-size setting. */}
            <Text
              allowFontScaling={false}
              className={`font-inter-medium text-[13px] ${
                isActive ? 'text-accent-foreground' : 'text-secondary-foreground'
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

function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center border-t border-surface-hairline py-3">
      <Spinner size="small" />
    </View>
  );
}

function subtitleFor(item: BookmarkedItem): string {
  switch (item.kind) {
    case 'event':
      return `${item.event.dayLabel} ${item.event.dateLabel} · ${item.event.timeLabel}`;
    case 'mission':
      return item.mission.scheduledFor
        ? formatDateOnly(item.mission.scheduledFor)
        : `${item.mission.stopsDone}/${item.mission.stopsTotal} stops`;
    case 'petition':
      return `${item.petition.signatureCount} of ${item.petition.requiredSignatures} signatures`;
    case 'post':
      return formatRelativeTime(item.bookmarkedAt);
    case 'service':
      return item.listing.serviceArea ?? formatRelativeTime(item.bookmarkedAt);
  }
}

function titleFor(item: BookmarkedItem): string {
  switch (item.kind) {
    case 'event':
      return item.event.title;
    case 'mission':
      return item.mission.title;
    case 'petition':
      return item.petition.title;
    case 'post':
      return item.post.title;
    case 'service':
      return item.listing.businessName;
  }
}

function BookmarkRow({
  item,
  onPress,
}: {
  readonly item: BookmarkedItem;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${KIND_LABEL[item.kind]}: ${titleFor(item)}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-surface-hairline px-4 py-3.5"
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name={KIND_ICON[item.kind]} size={16} />
      </View>
      <VStack className="flex-1 gap-0.5">
        <Text className="text-[11px] text-text-muted">{KIND_LABEL[item.kind]}</Text>
        <Text
          className="font-inter-bold text-[14px] text-content"
          numberOfLines={1}
        >
          {titleFor(item)}
        </Text>
        <Text className="text-[12px] text-text-muted">{subtitleFor(item)}</Text>
      </VStack>
      <Icon color="rgb(169,156,139)" name="ChevronRight" size={16} />
    </Pressable>
  );
}

export function BookmarksScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<BookmarksFilter>('all');
  const bookmarks = useBookmarks(filterToTargetType(filter));
  const toggleLike = useToggleLike();

  const [openItem, setOpenItem] = useState<BookmarkedItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [celebration, setCelebration] = useState<CheckInCelebration | null>(null);

  // Close the sheet first and let it slide down, then navigate once the
  // close animation finishes — navigating immediately would unmount the
  // screen (and the sheet with it) mid-animation.
  const closeThenNavigate = (
    path:
      | `/post/${string}`
      | `/event/${string}`
      | `/mission/${string}`
      | `/service/${string}`
      | `/petition/${string}`,
  ) => {
    setOpenItem(null);
    setTimeout(() => router.push(path as Href), CLOSE_DURATION);
  };

  const items = useMemo(
    (): readonly BookmarkedItem[] =>
      bookmarks.data?.pages.flatMap((page) => page.items) ?? [],
    [bookmarks.data],
  );

  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: bookmarks.fetchNextPage,
      hasNextPage: bookmarks.hasNextPage,
      isFetchingNextPage: bookmarks.isFetchingNextPage,
    },
  ]);

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ paddingTop: insets.top }}>
        <ScreenTitle
          eyebrow="Saved for later"
          onSearch={() => setIsSearching(true)}
          title="Bookmarks"
        />
      </View>

      <FilterChips active={filter} onSelect={setFilter} />

      {bookmarks.isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="xlarge" />
        </VStack>
      ) : items.length === 0 ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="Bookmark" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            Nothing bookmarked yet — tap the bookmark icon on a post, event,
            mission, service listing, or petition to save it here.
          </Text>
        </VStack>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130 }}
          onScroll={onScroll}
          scrollEventThrottle={100}
        >
          <VStack className="mx-5 mt-2 overflow-hidden rounded-[18px] border border-surface-hairline bg-paper shadow-card">
            {items.map((item) => (
              <BookmarkRow
                item={item}
                key={item.bookmarkId}
                onPress={() => setOpenItem(item)}
              />
            ))}
            <LoadMoreFooter isLoading={bookmarks.isFetchingNextPage} />
          </VStack>
        </ScrollView>
      )}

      <Sheet onClose={() => setOpenItem(null)} visible={openItem !== null}>
        {openItem?.kind === 'post' ? (
          <View className="px-1 pb-4">
            <PostCard
              onOpen={() => closeThenNavigate(`/post/${openItem.post.id}`)}
              onToggleLike={() =>
                toggleLike.mutate({
                  forum: openItem.post.forum,
                  postId: openItem.post.id,
                })
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
        {openItem?.kind === 'mission' ? (
          <View className="px-1 pb-4">
            <MissionCard
              mission={openItem.mission}
              onMissionComplete={setCelebration}
              onOpen={(missionId) => closeThenNavigate(`/mission/${missionId}`)}
            />
          </View>
        ) : null}
        {openItem?.kind === 'service' ? (
          <View className="px-1 pb-4">
            <ServiceListingCard
              listing={openItem.listing}
              onOpen={(listingId) => closeThenNavigate(`/service/${listingId}`)}
            />
          </View>
        ) : null}
        {openItem?.kind === 'petition' ? (
          <View className="px-4 pb-4">
            <PetitionRow
              onOpen={(petitionId) => closeThenNavigate(`/petition/${petitionId}`)}
              petition={openItem.petition}
            />
          </View>
        ) : null}
      </Sheet>

      <SearchSheet
        getKey={(item) => item.bookmarkId}
        getSubtitle={subtitleFor}
        getTitle={titleFor}
        items={items}
        onClose={() => setIsSearching(false)}
        onSelect={(item) => setOpenItem(item)}
        placeholder="Search your bookmarks"
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

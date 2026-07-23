import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { CLOSE_DURATION, Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { EventSummaryCard } from '@/src/modules/events';
import { PostCard, useToggleLike } from '@/src/modules/forum';
import { MissionCard } from '@/src/modules/missions';

import { useBookmarks, type BookmarkedItem, type BookmarkTargetType } from './use-bookmarks';

interface BookmarksScreenProps {
  readonly onClose: () => void;
}

type BookmarksFilter = 'all' | BookmarkTargetType;

const KIND_ICON: Readonly<Record<BookmarkTargetType, AppIconName>> = {
  event: 'CalendarDays',
  mission: 'Star',
  post: 'MessageCircle',
};

const KIND_LABEL: Readonly<Record<BookmarkTargetType, string>> = {
  event: 'Bookmarked event',
  mission: 'Bookmarked mission',
  post: 'Bookmarked post',
};

const FILTERS: readonly { readonly key: BookmarksFilter; readonly label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'post', label: 'Posts' },
  { key: 'event', label: 'Events' },
  { key: 'mission', label: 'Missions' },
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

function subtitleFor(item: BookmarkedItem): string {
  switch (item.kind) {
    case 'event':
      return `${item.event.dayLabel} ${item.event.dateLabel} · ${item.event.timeLabel}`;
    case 'mission':
      return item.mission.scheduledFor
        ? formatDateOnly(item.mission.scheduledFor)
        : `${item.mission.stopsDone}/${item.mission.stopsTotal} stops`;
    case 'post':
      return formatRelativeTime(item.bookmarkedAt);
  }
}

function titleFor(item: BookmarkedItem): string {
  switch (item.kind) {
    case 'event':
      return item.event.title;
    case 'mission':
      return item.mission.title;
    case 'post':
      return item.post.title;
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
      className="flex-row items-center gap-3 border-b border-line px-5 py-3.5"
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
      <Icon color="rgb(161,161,170)" name="ChevronRight" size={16} />
    </Pressable>
  );
}

export function BookmarksScreen({ onClose }: BookmarksScreenProps) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<BookmarksFilter>('all');
  const bookmarks = useBookmarks(filterToTargetType(filter));
  const toggleLike = useToggleLike();

  const [openItem, setOpenItem] = useState<BookmarkedItem | null>(null);

  // Close the sheet first and let it slide down, then navigate once the
  // close animation finishes — navigating immediately would unmount the
  // screen (and the sheet with it) mid-animation.
  const closeThenNavigate = (
    path: `/post/${string}` | `/event/${string}` | `/mission/${string}`,
  ) => {
    setOpenItem(null);
    setTimeout(() => router.push(path), CLOSE_DURATION);
  };

  const items = useMemo(
    (): readonly BookmarkedItem[] =>
      bookmarks.data?.pages.flatMap((page) => page.items) ?? [],
    [bookmarks.data],
  );

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className="items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Heading className="font-inter-bold" size="xl">
          Bookmarks
        </Heading>
        <Pressable
          accessibilityLabel="Close"
          className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
          onPress={onClose}
        >
          <Icon name="Close" size={18} />
        </Pressable>
      </HStack>

      <FilterChips active={filter} onSelect={setFilter} />

      {bookmarks.isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="large" />
        </VStack>
      ) : items.length === 0 ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="Bookmark" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            Nothing bookmarked yet — tap the bookmark icon on a post, event, or
            mission to save it here.
          </Text>
        </VStack>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {items.map((item) => (
            <BookmarkRow
              item={item}
              key={item.bookmarkId}
              onPress={() => setOpenItem(item)}
            />
          ))}
          {bookmarks.hasNextPage ? (
            <LoadMoreRow
              isLoading={bookmarks.isFetchingNextPage}
              onPress={() => void bookmarks.fetchNextPage()}
            />
          ) : null}
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
              onOpen={(missionId) => closeThenNavigate(`/mission/${missionId}`)}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

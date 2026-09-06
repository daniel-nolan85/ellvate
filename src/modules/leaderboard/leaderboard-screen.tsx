import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { ScopedSearchScreen } from '@/src/components/shared/scoped-search-screen';
import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';
import { useOpenProfile } from '@/src/modules/profile';

import { LeaderRow } from './leader-row';
import { Podium } from './podium';
import {
  useLeaderboard,
  type LeaderboardEntry,
  type LeaderboardRange,
} from './use-leaderboard';

const RANGE_TABS: readonly {
  readonly value: LeaderboardRange;
  readonly label: string;
}[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

function RangeTabs({
  active,
  onSelect,
}: {
  readonly active: LeaderboardRange;
  readonly onSelect: (range: LeaderboardRange) => void;
}) {
  return (
    <HStack className="mx-5 gap-2">
      {RANGE_TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Pressable
            className={`flex-1 items-center rounded-full py-2 ${
              isActive ? 'bg-primary' : 'bg-secondary'
            }`}
            key={tab.value}
            onPress={() => onSelect(tab.value)}
          >
            <Text
              className={`font-inter-semibold text-[13px] ${
                isActive
                  ? 'text-primary-foreground'
                  : 'text-secondary-foreground'
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

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<LeaderboardRange>('all');
  const leaderboard = useLeaderboard(range);
  const leaders = leaderboard.data?.pages.flatMap((page) => page.leaders) ?? [];
  const openProfile = useOpenProfile();
  const [isSearching, setIsSearching] = useState(false);

  // Selecting a search result jumps to that person's row in the actual
  // ranking instead of opening their profile directly -- opening the
  // profile straight from search would be no different from finding them
  // through the app-wide search, and would throw away the one thing this
  // scoped search can show that the app-wide one can't: where they stand.
  // From their row, the existing LeaderRow onPress still opens the profile
  // the normal way. highlightedRank briefly outlines that row so it's
  // clear which one search actually landed on, since scrolling alone
  // doesn't say which of several visible rows was the target.
  const listRef = useRef<FlatList<LeaderboardEntry>>(null);
  const [highlightedRank, setHighlightedRank] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    },
    [],
  );
  const handleSelectFromSearch = (entry: LeaderboardEntry) => {
    setIsSearching(false);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedRank(entry.rank);
    highlightTimeoutRef.current = setTimeout(
      () => setHighlightedRank(null),
      2500,
    );
    const index = leaders.findIndex(
      (candidate) => candidate.rank === entry.rank,
    );
    if (index === -1) {
      return;
    }
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        animated: true,
        index,
        viewPosition: 0.3,
      });
    });
  };

  const hasLeaders =
    !leaderboard.isPending && !leaderboard.isError && leaders.length > 0;

  return (
    <>
      {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
          ActivitySectionList for why: only rows actually on/near screen
          mount as real native views here, no matter how many leaders load.
          The Activity/Bookmarks screens hit this exact failure mode once
          content grew large enough. */}
      <FlatList<LeaderboardEntry>
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        data={hasLeaders ? leaders : []}
        keyExtractor={(entry) => String(entry.rank)}
        ListEmptyComponent={
          leaderboard.isPending ? (
            <Box className="items-center justify-center py-24">
              <Spinner size="xlarge" />
            </Box>
          ) : leaderboard.isError ? (
            <VStack className="items-center px-5 py-16" space="md">
              <Text className="text-center text-muted-foreground" size="sm">
                Could not load the leaderboard.
              </Text>
              <Button
                action="secondary"
                className="rounded-full"
                onPress={() => void leaderboard.refetch()}
                size="sm"
                variant="outline"
              >
                <ButtonText>Retry</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack className="items-center px-10 py-16" space="xs">
              <Text
                className="text-center font-inter-semibold text-content"
                size="sm"
              >
                No missions completed yet
              </Text>
              <Text className="text-center text-text-muted" size="xs">
                Be the first to check in{' '}
                {range === 'week' ? 'this week' : 'this month'}.
              </Text>
            </VStack>
          )
        }
        ListFooterComponent={
          !hasLeaders ? null : leaderboard.hasNextPage ? (
            leaderboard.isFetchingNextPage ? (
              <Box className="items-center py-3" testID="leaderboard-load-more">
                <Spinner size="small" />
              </Box>
            ) : null
          ) : (
            <AllCaughtUp />
          )
        }
        ListHeaderComponent={
          <VStack space="md">
            {/* Leaderboard is a plain pushed screen (not a tab), so unlike
                the tab bar's own screens it needs its own top safe-area
                padding -- matching Profile/Activity/Bookmarks, which
                already wrap ScreenTitle the same way. */}
            <View style={{ paddingTop: insets.top }}>
              <ScreenTitle
                eyebrow={
                  RANGE_TABS.find((tab) => tab.value === range)?.label ??
                  'All time'
                }
                onSearch={
                  leaders.length > 0 ? () => setIsSearching(true) : undefined
                }
                title="Leaderboard"
              />
            </View>
            <RangeTabs active={range} onSelect={setRange} />
            {hasLeaders ? (
              <View className="pb-1.5">
                <Podium
                  leaders={leaders}
                  onPress={(entry) =>
                    openProfile(entry.user.id, entry.user.name)
                  }
                />
              </View>
            ) : null}
          </VStack>
        }
        onEndReached={() => {
          if (leaderboard.hasNextPage && !leaderboard.isFetchingNextPage) {
            void leaderboard.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={() => void leaderboard.refetch()}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              animated: true,
              offset: info.averageItemLength * info.index,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                animated: true,
                index: info.index,
                viewPosition: 0.3,
              });
            }, 100);
          }, 50);
        }}
        ref={listRef}
        refreshing={leaderboard.isRefetching}
        renderItem={({ item }) => (
          <View
            className={`mx-5 mb-1 rounded-[18px] border-2 ${
              item.rank === highlightedRank
                ? 'border-accent'
                : 'border-transparent'
            }`}
          >
            <LeaderRow
              entry={item}
              onPress={(pressed) =>
                openProfile(pressed.user.id, pressed.user.name)
              }
            />
          </View>
        )}
      />

      <ScopedSearchScreen
        getKey={(entry) => entry.user.id}
        getSubtitle={(entry) =>
          `#${entry.rank} · ${entry.xp.toLocaleString()} XP`
        }
        getTitle={(entry) => entry.user.name}
        items={leaders}
        onClose={() => setIsSearching(false)}
        onSelect={handleSelectFromSearch}
        placeholder="Search the leaderboard"
        visible={isSearching}
      />

      <CommunityNavBar />
    </>
  );
}

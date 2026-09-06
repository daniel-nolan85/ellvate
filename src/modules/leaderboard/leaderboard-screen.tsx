import { useEffect, useRef, useState } from 'react';
import { findNodeHandle, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { ScopedSearchScreen } from '@/src/components/shared/scoped-search-screen';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
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
import { useLeaderboard, type LeaderboardEntry, type LeaderboardRange } from './use-leaderboard';

const RANGE_TABS: readonly { readonly value: LeaderboardRange; readonly label: string }[] = [
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
                isActive ? 'text-primary-foreground' : 'text-secondary-foreground'
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
  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: leaderboard.fetchNextPage,
      hasNextPage: leaderboard.hasNextPage,
      isFetchingNextPage: leaderboard.isFetchingNextPage,
    },
  ]);

  // Selecting a search result jumps to that person's row in the actual
  // ranking instead of opening their profile directly -- opening the
  // profile straight from search would be no different from finding them
  // through the app-wide search, and would throw away the one thing this
  // scoped search can show that the app-wide one can't: where they stand.
  // From their row, the existing LeaderRow onPress still opens the profile
  // the normal way. highlightedRank briefly outlines that row so it's
  // clear which one search actually landed on, since scrolling alone
  // doesn't say which of several visible rows was the target.
  const scrollViewRef = useRef<ScrollView>(null);
  const rowRefs = useRef(new Map<number, View>());
  const [highlightedRank, setHighlightedRank] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    requestAnimationFrame(() => {
      const rowNode = rowRefs.current.get(entry.rank);
      const scrollNode = scrollViewRef.current;
      const scrollHandle = scrollNode ? findNodeHandle(scrollNode) : null;
      setHighlightedRank(entry.rank);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedRank(null), 2500);
      if (!rowNode || !scrollNode || !scrollHandle) {
        return;
      }
      rowNode.measureLayout(
        scrollHandle,
        (_x, y) => scrollNode.scrollTo({ animated: true, y: Math.max(0, y - 24) }),
        () => {},
      );
    });
  };

  return (
    <>
      <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 130 }}
      onScroll={onScroll}
      ref={scrollViewRef}
      scrollEventThrottle={100}
    >
      <VStack space="md">
        {/* Leaderboard is a plain pushed screen (not a tab), so unlike the
            tab bar's own screens it needs its own top safe-area padding --
            matching Profile/Activity/Bookmarks, which already wrap
            ScreenTitle the same way. */}
        <View style={{ paddingTop: insets.top }}>
          <ScreenTitle
            eyebrow={RANGE_TABS.find((tab) => tab.value === range)?.label ?? 'All time'}
            onSearch={leaders.length > 0 ? () => setIsSearching(true) : undefined}
            title="Leaderboard"
          />
        </View>
        <RangeTabs active={range} onSelect={setRange} />
        {leaderboard.isPending ? (
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
        ) : leaders.length === 0 ? (
          <VStack className="items-center px-10 py-16" space="xs">
            <Text className="text-center font-inter-semibold text-content" size="sm">
              No missions completed yet
            </Text>
            <Text className="text-center text-text-muted" size="xs">
              Be the first to check in {range === 'week' ? 'this week' : 'this month'}.
            </Text>
          </VStack>
        ) : (
          <>
            <Podium
              leaders={leaders}
              onPress={(entry) => openProfile(entry.user.id, entry.user.name)}
            />
            <VStack className="px-5 pt-1.5" space="xs">
              {leaders.map((entry) => (
                <View
                  className={`rounded-[18px] border-2 ${
                    entry.rank === highlightedRank ? 'border-accent' : 'border-transparent'
                  }`}
                  key={entry.rank}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(entry.rank, node);
                    } else {
                      rowRefs.current.delete(entry.rank);
                    }
                  }}
                >
                  <LeaderRow
                    entry={entry}
                    onPress={(pressed) => openProfile(pressed.user.id, pressed.user.name)}
                  />
                </View>
              ))}
            </VStack>
            {leaderboard.hasNextPage ? (
              leaderboard.isFetchingNextPage ? (
                <Box className="items-center py-3" testID="leaderboard-load-more">
                  <Spinner size="small" />
                </Box>
              ) : null
            ) : (
              <AllCaughtUp />
            )}
          </>
        )}
      </VStack>
    </ScrollView>

      <ScopedSearchScreen
        getKey={(entry) => entry.user.id}
        getSubtitle={(entry) => `#${entry.rank} · ${entry.xp.toLocaleString()} XP`}
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

import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';

import { LeaderRow } from './leader-row';
import { Podium } from './podium';
import { useLeaderboard, type LeaderboardRange } from './use-leaderboard';

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
  const [range, setRange] = useState<LeaderboardRange>('all');
  const leaderboard = useLeaderboard(range);
  const leaders = leaderboard.data?.pages.flatMap((page) => page.leaders) ?? [];
  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: leaderboard.fetchNextPage,
      hasNextPage: leaderboard.hasNextPage,
      isFetchingNextPage: leaderboard.isFetchingNextPage,
    },
  ]);

  return (
    <>
      <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 130 }}
      onScroll={onScroll}
      scrollEventThrottle={100}
    >
      <VStack space="md">
        <ScreenTitle
          eyebrow={RANGE_TABS.find((tab) => tab.value === range)?.label ?? 'All time'}
          title="Leaderboard"
        />
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
            <Podium leaders={leaders} />
            <VStack className="px-5 pt-1.5" space="xs">
              {leaders.map((entry) => (
                <LeaderRow entry={entry} key={entry.rank} />
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
      <CommunityNavBar />
    </>
  );
}

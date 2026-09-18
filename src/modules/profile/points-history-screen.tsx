import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { EmptyState } from '@/src/components/shared/empty-state';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';

import { RankList } from './rank-list';
import { useProfileStats } from './use-profile';
import {
  usePointsHistory,
  type PointsHistoryEntry,
  type PointsHistoryFilter,
  type PointsHistoryReason,
} from './use-points-history';
import { useXpGrowth } from './use-xp-growth';
import { XpGrowthChart } from './xp-growth-chart';

type PointsHistoryTab = 'history' | 'growth';

const TABS: readonly { readonly key: PointsHistoryTab; readonly label: string }[] = [
  { key: 'history', label: 'History' },
  { key: 'growth', label: 'Growth' },
];

const FILTERS: readonly { readonly key: PointsHistoryFilter; readonly label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'missions', label: 'Missions' },
  { key: 'posts', label: 'Posts' },
  { key: 'events', label: 'Events' },
  { key: 'services', label: 'Services' },
];

const REASON_ICON: Readonly<Record<PointsHistoryReason, AppIconName>> = {
  event_created: 'CalendarDays',
  mission_completed: 'Star',
  mission_created: 'Star',
  onboarding_bonus: 'Sparkles',
  post_created: 'MessageCircle',
  service_created: 'Store',
};

const REASON_LABEL: Readonly<Record<PointsHistoryReason, string>> = {
  event_created: 'Created an event',
  mission_completed: 'Completed a mission',
  mission_created: 'Created a mission',
  onboarding_bonus: 'Welcome bonus',
  post_created: 'Posted in the forum',
  service_created: 'Listed a service',
};

function TabSwitcher({
  active,
  onSelect,
}: {
  readonly active: PointsHistoryTab;
  readonly onSelect: (tab: PointsHistoryTab) => void;
}) {
  return (
    <HStack className="px-5 pb-3" collapsable={false} space="sm">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            className={`flex-1 items-center rounded-full py-2.5 ${
              isActive ? 'bg-accent' : 'bg-secondary'
            }`}
            key={tab.key}
            onPress={() => onSelect(tab.key)}
          >
            <Text
              className={`font-inter-semibold text-[13px] ${
                isActive ? 'text-accent-foreground' : 'text-secondary-foreground'
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

function FilterChips({
  active,
  onSelect,
}: {
  readonly active: PointsHistoryFilter;
  readonly onSelect: (filter: PointsHistoryFilter) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 2 }}
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
            key={filter.key}
            onPress={() => onSelect(filter.key)}
          >
            <Text
              className={`font-inter-medium text-[13px] leading-[18px] ${
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

function HistoryRow({ entry }: { readonly entry: PointsHistoryEntry }) {
  return (
    <HStack className="items-center gap-3 px-5 py-2.5">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
        <Icon color="rgb(181,80,44)" name={REASON_ICON[entry.reason]} size={16} />
      </View>
      <VStack className="flex-1">
        <Text className="font-inter-medium text-[14px] text-content">
          {REASON_LABEL[entry.reason]}
        </Text>
        <Text className="text-text-muted" size="xs">
          {formatRelativeTime(entry.createdAt)}
        </Text>
      </VStack>
      <Text className="font-inter-bold text-[14px] text-accent">+{entry.amount} XP</Text>
    </HStack>
  );
}

export function PointsHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<PointsHistoryTab>('history');
  const [filter, setFilter] = useState<PointsHistoryFilter>('all');
  const stats = useProfileStats();
  const history = usePointsHistory(filter, tab === 'history');
  const growth = useXpGrowth(tab === 'growth');
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className="items-center gap-2 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityLabel="Back" onPress={() => router.back()}>
          <Icon name="ChevronLeft" size={22} />
        </Pressable>
        <Heading className="flex-1 font-inter-bold text-[16px]" size="sm">
          Points History
        </Heading>
      </HStack>

      <TabSwitcher active={tab} onSelect={setTab} />

      {tab === 'history' ? (
        <FlatList
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          data={entries}
          keyExtractor={(entry) => entry.id}
          ListEmptyComponent={
            history.isPending ? (
              <View className="items-center py-8">
                <Spinner />
              </View>
            ) : (
              <EmptyState
                heading={filter === 'all' ? 'No points earned yet' : 'Nothing in this category yet'}
                icon="Star"
                subtext={
                  filter === 'all'
                    ? 'Complete missions, post, and join events to start earning XP.'
                    : 'Try a different filter.'
                }
              />
            )
          }
          ListFooterComponent={
            history.isFetchingNextPage ? (
              <View className="items-center py-3" testID="points-history-load-more">
                <Spinner size="small" />
              </View>
            ) : null
          }
          ListHeaderComponent={
            <VStack className="gap-3 pb-1" space="xs">
              {stats.data ? <RankList level={stats.data.level} /> : null}
              <FilterChips active={filter} onSelect={setFilter} />
            </VStack>
          }
          onEndReached={() => {
            if (history.hasNextPage && !history.isFetchingNextPage) {
              void history.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          onRefresh={() => void history.refetch()}
          refreshing={history.isRefetching}
          renderItem={({ item }) => <HistoryRow entry={item} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl onRefresh={() => void growth.refetch()} refreshing={growth.isRefetching} />
          }
        >
          {growth.isPending ? (
            <View className="items-center py-16">
              <Spinner size="xlarge" />
            </View>
          ) : growth.data && growth.data.points.length > 0 ? (
            <XpGrowthChart points={growth.data.points} />
          ) : (
            <EmptyState
              heading="No activity yet"
              icon="TrendingUp"
              subtext="Earn XP to start tracking your growth over time."
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

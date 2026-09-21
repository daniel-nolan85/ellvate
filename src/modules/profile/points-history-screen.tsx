import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/src/components/shared/empty-state';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';

import { RankList } from './rank-list';
import { useProfileStats } from './use-profile';
import {
  usePointsHistory,
  type PointsHistoryEntry,
  type PointsHistoryFilter,
  type PointsHistoryMonth,
  type PointsHistoryReason,
} from './use-points-history';
import { useXpGrowth } from './use-xp-growth';
import { XpGrowthChart } from './xp-growth-chart';

type PointsHistoryTab = 'history' | 'growth' | 'ranks';

const TABS: readonly { readonly key: PointsHistoryTab; readonly label: string }[] = [
  { key: 'history', label: 'History' },
  { key: 'growth', label: 'Growth' },
  { key: 'ranks', label: 'Ranks' },
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

interface MonthOption {
  readonly key: PointsHistoryMonth;
  readonly label: string;
}

// How far back the year stepper can go -- a bound rather than unlimited
// scrollback, for the same reason the old rolling-12-months list was
// bounded: nothing stops a long-tenured member from tapping "previous
// year" forever otherwise.
const MIN_YEAR = new Date().getFullYear() - 10;

// Every month in `year` up to (and including) the current month if `year`
// is the current year, or all 12 if it's a past year -- future months
// never have data, so they're never offered.
function monthsForYear(year: number): readonly MonthOption[] {
  const now = new Date();
  const lastMonthIndex = year === now.getFullYear() ? now.getMonth() : 11;
  const options: MonthOption[] = [];
  for (let index = 0; index <= lastMonthIndex; index += 1) {
    const date = new Date(year, index, 1);
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'short' });
    options.push({ key: key as PointsHistoryMonth, label });
  }
  return options;
}

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

// A single year chip (e.g. "2026") with prev/next steppers instead of a
// flat month list, since listing every month back to account creation
// doesn't scale -- tapping the year expands the months within it below,
// and the steppers browse other years without ever needing to.
function YearMonthFilter({
  activeMonth,
  onChangeYear,
  onSelectAllTime,
  onSelectMonth,
  onToggleYear,
  selectedYear,
  yearExpanded,
}: {
  readonly activeMonth: PointsHistoryMonth;
  readonly onChangeYear: (delta: 1 | -1) => void;
  readonly onSelectAllTime: () => void;
  readonly onSelectMonth: (month: PointsHistoryMonth) => void;
  readonly onToggleYear: () => void;
  readonly selectedYear: number;
  readonly yearExpanded: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const isAllTime = activeMonth === 'all';
  const isYearActive = !isAllTime && activeMonth.startsWith(`${selectedYear}-`);
  const canGoBack = selectedYear > MIN_YEAR;
  const canGoForward = selectedYear < currentYear;

  return (
    <VStack className="gap-2">
      <HStack className="items-center gap-2 px-5">
        <Pressable
          className={`shrink-0 rounded-full px-3.5 py-[7px] ${
            isAllTime ? 'bg-accent' : 'bg-secondary'
          }`}
          onPress={onSelectAllTime}
        >
          <Text
            className={`font-inter-medium text-[13px] leading-[18px] ${
              isAllTime ? 'text-accent-foreground' : 'text-secondary-foreground'
            }`}
          >
            All Time
          </Text>
        </Pressable>
        <HStack className="flex-1 items-center justify-end gap-1">
          <Pressable
            accessibilityLabel="Previous year"
            disabled={!canGoBack}
            hitSlop={8}
            onPress={() => onChangeYear(-1)}
            style={{ opacity: canGoBack ? 1 : 0.3 }}
          >
            <Icon name="ChevronLeft" size={18} />
          </Pressable>
          <Pressable
            className={`rounded-full px-3.5 py-[7px] ${
              isYearActive || yearExpanded ? 'bg-accent' : 'bg-secondary'
            }`}
            onPress={onToggleYear}
          >
            <Text
              className={`font-inter-medium text-[13px] leading-[18px] ${
                isYearActive || yearExpanded ? 'text-accent-foreground' : 'text-secondary-foreground'
              }`}
            >
              {selectedYear}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Next year"
            disabled={!canGoForward}
            hitSlop={8}
            onPress={() => onChangeYear(1)}
            style={{ opacity: canGoForward ? 1 : 0.3 }}
          >
            <Icon name="ChevronRight" size={18} />
          </Pressable>
        </HStack>
      </HStack>
      {yearExpanded ? (
        <ScrollView
          contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 2 }}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
        >
          {monthsForYear(selectedYear).map((month) => {
            const isActive = month.key === activeMonth;
            return (
              <Pressable
                className={`shrink-0 rounded-full px-3.5 py-[7px] ${
                  isActive ? 'bg-accent' : 'bg-secondary'
                }`}
                key={month.key}
                onPress={() => onSelectMonth(month.key)}
              >
                <Text
                  className={`font-inter-medium text-[13px] leading-[18px] ${
                    isActive ? 'text-accent-foreground' : 'text-secondary-foreground'
                  }`}
                >
                  {month.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </VStack>
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
  const [month, setMonth] = useState<PointsHistoryMonth>('all');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [yearExpanded, setYearExpanded] = useState(false);
  const stats = useProfileStats();
  const history = usePointsHistory(filter, month, tab === 'history');
  const growth = useXpGrowth(tab === 'growth');
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <View className="flex-1 bg-canvas">
      {/* Same ScreenTitle + CommunityNavBar pairing every peer screen
          (Bookmarks, Blocked users, ...) uses, avatar button included --
          no back chevron, since the avatar already routes back to Profile
          and the floating nav bar covers everything else. */}
      <View style={{ paddingTop: insets.top }}>
        <ScreenTitle eyebrow="Your progress" title="Points History" />
      </View>

      <TabSwitcher active={tab} onSelect={setTab} />

      {tab === 'ranks' ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130, paddingTop: 4 }}
          refreshControl={
            <RefreshControl onRefresh={() => void stats.refetch()} refreshing={stats.isRefetching} />
          }
        >
          {stats.data ? (
            <RankList level={stats.data.level} />
          ) : (
            <View className="items-center py-16">
              <Spinner size="xlarge" />
            </View>
          )}
        </ScrollView>
      ) : tab === 'history' ? (
        <FlatList
          contentContainerStyle={{ paddingBottom: 130 }}
          data={entries}
          keyExtractor={(entry) => entry.id}
          ListEmptyComponent={
            history.isPending ? (
              <View className="items-center py-8">
                <Spinner />
              </View>
            ) : (
              <EmptyState
                heading={
                  filter === 'all' && month === 'all'
                    ? 'No points earned yet'
                    : 'Nothing in this range yet'
                }
                icon="Star"
                subtext={
                  filter === 'all' && month === 'all'
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
            <VStack className="gap-2 pb-1" space="xs">
              <FilterChips active={filter} onSelect={setFilter} />
              <YearMonthFilter
                activeMonth={month}
                onChangeYear={(delta) => setSelectedYear((year) => year + delta)}
                onSelectAllTime={() => {
                  setMonth('all');
                  setYearExpanded(false);
                }}
                onSelectMonth={(selected) => {
                  setMonth(selected);
                  setYearExpanded(false);
                }}
                onToggleYear={() => setYearExpanded((expanded) => !expanded)}
                selectedYear={selectedYear}
                yearExpanded={yearExpanded}
              />
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
          contentContainerStyle={{ paddingBottom: 130 }}
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

      <CommunityNavBar />
    </View>
  );
}

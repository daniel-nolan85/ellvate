import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';

import {
  usePointsHistory,
  type PointsHistoryEntry,
  type PointsHistoryFilter,
  type PointsHistoryReason,
} from './use-points-history';

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

function FilterChips({
  active,
  onSelect,
}: {
  readonly active: PointsHistoryFilter;
  readonly onSelect: (filter: PointsHistoryFilter) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ alignItems: 'center', gap: 8, paddingVertical: 2 }}
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
    <HStack className="items-center gap-3 py-2.5">
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

export function PointsHistorySheet({
  onClose,
  visible,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
}) {
  const [filter, setFilter] = useState<PointsHistoryFilter>('all');
  const history = usePointsHistory(filter, visible);
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? [];

  return (
    <Sheet onClose={onClose} visible={visible}>
      <VStack className="gap-3 px-[18px] pb-4" space="xs">
        <Text className="font-inter-bold text-[17px] text-content">Points history</Text>
        <FilterChips active={filter} onSelect={setFilter} />
        {history.isPending ? (
          <View className="items-center py-8">
            <Spinner />
          </View>
        ) : entries.length > 0 ? (
          <FlatList
            data={entries}
            keyExtractor={(entry) => entry.id}
            ListFooterComponent={
              history.isFetchingNextPage ? (
                <View className="items-center py-3" testID="points-history-load-more">
                  <Spinner size="small" />
                </View>
              ) : null
            }
            onEndReached={() => {
              if (history.hasNextPage && !history.isFetchingNextPage) {
                void history.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => <HistoryRow entry={item} />}
            style={{ maxHeight: 420 }}
          />
        ) : (
          <Text className="py-2 text-text-muted" size="sm">
            {filter === 'all' ? 'No points earned yet.' : 'Nothing in this category yet.'}
          </Text>
        )}
      </VStack>
    </Sheet>
  );
}

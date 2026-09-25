import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { EmptyState } from '@/src/components/shared/empty-state';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { MissionCard } from './mission-card';
import { MissionComposer } from './mission-composer';
import { useCreateMission, useMissionsProgress, useMissionsView, type MissionFilter } from './use-missions';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

const MISSION_FILTERS: readonly {
  readonly key: MissionFilter;
  readonly label: string;
}[] = [
  { key: 'available', label: 'Available' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center py-3" testID="missions-load-more">
      <Spinner size="small" />
    </View>
  );
}

function MissionFilterChips({
  active,
  onSelect,
}: {
  readonly active: MissionFilter;
  readonly onSelect: (filter: MissionFilter) => void;
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
      {MISSION_FILTERS.map((filter) => {
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
                isActive
                  ? 'text-accent-foreground'
                  : 'text-secondary-foreground'
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

interface MissionsScreenProps {
  readonly onOpenMission?: (missionId: string) => void;
  readonly onOpenLeaderboard?: () => void;
}

function CreateButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button
      className="rounded-full bg-accent px-4"
      onPress={onPress}
      size="sm"
      testID="missions-add"
    >
      <Icon color={COLOR_ACCENT_FOREGROUND} name="Add" size={14} />
      <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
        Create
      </ButtonText>
    </Button>
  );
}

function LeaderboardButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button
      accessibilityLabel="Open leaderboard"
      className="rounded-full bg-accent-subtle px-3"
      onPress={onPress}
      size="sm"
      testID="missions-open-leaderboard"
    >
      <Icon color="rgb(181,80,44)" name="Trophy" size={16} />
    </Button>
  );
}

export function MissionsScreen({
  onOpenLeaderboard,
  onOpenMission,
}: MissionsScreenProps) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<MissionFilter>('available');
  const missionsView = useMissionsView(filter);
  const progress = useMissionsProgress();
  const createMission = useCreateMission();
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const missions =
    missionsView.data?.pages.flatMap((page) => page.missions) ?? [];

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <View className="flex-1">
      {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
          ActivitySectionList for why: this screen pairs a filter-chip row
          (MissionFilterChips) with a growing list, the exact shape that
          caused My Activity's "All" filter pills to corrupt under enough
          simultaneous content. Only rows actually on/near screen mount as
          real native views here, no matter how many missions load. */}
      <FlatList
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        data={missionsView.isPending || missionsView.isError ? [] : missions}
        keyExtractor={(mission) => mission.id}
        ListEmptyComponent={
          missionsView.isPending ? (
            <VStack className="items-center justify-center py-24">
              <Spinner size="xlarge" />
            </VStack>
          ) : missionsView.isError ? (
            <VStack className="items-center gap-3 px-5 py-24">
              <Text className="text-center text-muted-foreground" size="sm">
                Couldn&apos;t load missions.
              </Text>
              <Button
                className="rounded-full bg-accent"
                onPress={() => void missionsView.refetch()}
                size="sm"
              >
                <ButtonText className="font-inter-semibold text-accent-foreground">
                  Retry
                </ButtonText>
              </Button>
            </VStack>
          ) : (
            <EmptyState
              heading={
                filter === 'available'
                  ? 'No missions available'
                  : filter === 'in-progress'
                    ? 'Nothing in progress'
                    : 'No missions completed yet'
              }
              icon="Star"
              subtext={
                filter === 'available'
                  ? 'Check back soon, or create one yourself.'
                  : filter === 'in-progress'
                    ? 'Accept a mission to see it here.'
                    : 'Finish a mission to see it here.'
              }
            />
          )
        }
        ListFooterComponent={
          missions.length === 0 ? null : missionsView.hasNextPage ? (
            <LoadMoreFooter isLoading={missionsView.isFetchingNextPage} />
          ) : (
            <AllCaughtUp />
          )
        }
        ListHeaderComponent={
          <VStack className="gap-4 pb-1">
            <ScreenTitle
              eyebrow="Explore & earn"
              onSearch={() => router.push('/search')}
              right={
                <HStack className="items-center gap-2">
                  {onOpenLeaderboard ? (
                    <LeaderboardButton onPress={onOpenLeaderboard} />
                  ) : null}
                  <CreateButton onPress={() => setComposing(true)} />
                </HStack>
              }
              title="Missions"
            />

            <VStack className="mx-5 gap-1 rounded-2xl bg-accent-subtle px-4 py-3">
              <Text className="font-inter-semibold text-[13px] text-accent">
                🌵 Explore. Discover. Earn.
              </Text>
              <Text className="text-[12px] leading-4 text-accent">
                Missions are designed to get you out and experiencing Lake
                Las Vegas. Please check in honestly and keep things fair.
                The XP is the bonus. The adventure is the point.
              </Text>
            </VStack>

            <MissionFilterChips active={filter} onSelect={setFilter} />
            {missionsView.isPending ||
            missionsView.isError ||
            missions.length === 0 ? null : (
              <Text className="px-5 py-0.5 font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                Near you
              </Text>
            )}
          </VStack>
        }
        onEndReached={() => {
          if (missionsView.hasNextPage && !missionsView.isFetchingNextPage) {
            void missionsView.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={() => {
          void missionsView.refetch();
          void progress.refetch();
        }}
        refreshing={missionsView.isRefetching || progress.isRefetching}
        renderItem={({ item }) => (
          <View className="mx-5 mb-2">
            <MissionCard
              mission={item}
              onAccepted={() => setFilter('in-progress')}
              onOpen={onOpenMission}
            />
          </View>
        )}
      />

      <Sheet onClose={() => setComposing(false)} visible={composing}>
        {(maxContentHeight) => (
          <MissionComposer
            isSubmitting={createMission.isPending}
            maxContentHeight={maxContentHeight}
            onDismiss={() => setComposing(false)}
            onSubmit={(draft) =>
              createMission.mutate(
                {
                  description: draft.description,
                  theme: draft.theme,
                  newMedia: draft.newMedia,
                  scheduledFor: draft.scheduledFor,
                  stops: draft.stops,
                  title: draft.title,
                  xp: draft.xp,
                },
                {
                  onSuccess: () => {
                    setComposing(false);
                    showToast('Mission created!');
                  },
                },
              )
            }
          />
        )}
      </Sheet>

      {toast ? (
        <View
          className="absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3"
          style={{ bottom: insets.bottom + 96 }}
        >
          <Icon color="rgb(250,250,250)" name="CheckCircle" size={16} />
          <Text className="flex-1 text-[14px] text-primary-foreground">
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

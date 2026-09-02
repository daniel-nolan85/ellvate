import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { router } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { LevelUpCelebrationModal } from './level-up-celebration-modal';
import { MissionCard } from './mission-card';
import { MissionCelebrationModal } from './mission-celebration-modal';
import { MissionComposer } from './mission-composer';
import {
  useCreateMission,
  useMissionsProgress,
  useMissionsView,
  type CheckInCelebration,
  type MissionFilter,
} from './use-missions';
import { XpHero } from './xp-hero';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

const MISSION_FILTERS: readonly { readonly key: MissionFilter; readonly label: string }[] = [
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
  const [filter, setFilter] = useState<MissionFilter>('available');
  const missionsView = useMissionsView(filter);
  const progress = useMissionsProgress();
  const createMission = useCreateMission();
  const [composing, setComposing] = useState(false);
  const [celebration, setCelebration] = useState<CheckInCelebration | null>(null);

  const missions = missionsView.data?.pages.flatMap((page) => page.missions) ?? [];

  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: missionsView.fetchNextPage,
      hasNextPage: missionsView.hasNextPage,
      isFetchingNextPage: missionsView.isFetchingNextPage,
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
        <VStack className="gap-4">
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

          {progress.data ? <XpHero progress={progress.data} /> : null}
          <MissionFilterChips active={filter} onSelect={setFilter} />

          {missionsView.isPending ? (
          <VStack className="items-center justify-center py-24">
            <Spinner size="xlarge" />
          </VStack>
        ) : missionsView.isError ? (
          <VStack className="items-center gap-3 px-5 py-24">
            <Text className="text-center text-muted-foreground" size="sm">
              Couldn&apos;t load missions.
            </Text>
            <Button
              className="rounded-full bg-primary"
              onPress={() => void missionsView.refetch()}
              size="sm"
            >
              <ButtonText className="font-inter-semibold text-primary-foreground">
                Retry
              </ButtonText>
            </Button>
          </VStack>
        ) : (
            <VStack className="gap-2 px-5 pt-1">
              <Text className="py-0.5 font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                Near you
              </Text>
              {missions.length === 0 ? (
                <Text className="py-2 text-muted-foreground" size="sm">
                  No missions in this filter yet.
                </Text>
              ) : (
                <>
                  {missions.map((mission) => (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      onMissionComplete={setCelebration}
                      onOpen={onOpenMission}
                    />
                  ))}
                  {missionsView.hasNextPage ? (
                    <LoadMoreFooter isLoading={missionsView.isFetchingNextPage} />
                  ) : (
                    <AllCaughtUp />
                  )}
                </>
              )}
            </VStack>
        )}
        </VStack>
      </ScrollView>

      <Sheet onClose={() => setComposing(false)} visible={composing}>
        <MissionComposer
          isSubmitting={createMission.isPending}
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
              { onSuccess: () => setComposing(false) },
            )
          }
        />
      </Sheet>

      <MissionCelebrationModal
        awardedXp={celebration && celebration.leveledUpTo === null ? celebration.awardedXp : null}
        onClose={() => setCelebration(null)}
      />
      <LevelUpCelebrationModal
        newLevel={celebration?.leveledUpTo ?? null}
        onClose={() => setCelebration(null)}
      />
    </>
  );
}

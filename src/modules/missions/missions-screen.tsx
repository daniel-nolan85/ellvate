import { Pressable, ScrollView } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { MissionCard } from './mission-card';
import { useMissionsView } from './use-missions';
import { XpHero } from './xp-hero';

interface MissionsScreenProps {
  readonly onOpenLeaderboard: () => void;
}

function RanksChip({ onPress }: { readonly onPress: () => void }) {
  return (
    <Pressable
      className="flex-row items-center gap-1.5 rounded-full bg-secondary px-3.5 py-[9px]"
      onPress={onPress}
    >
      <Icon name="ChevronsUpDown" size={14} />
      <Text className="font-inter-semibold text-[12px] leading-[16px] text-content">
        Ranks
      </Text>
    </Pressable>
  );
}

export function MissionsScreen({ onOpenLeaderboard }: MissionsScreenProps) {
  const missionsView = useMissionsView();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <VStack className="gap-4">
        <ScreenTitle
          eyebrow="Explore & earn"
          right={<RanksChip onPress={onOpenLeaderboard} />}
          title="Missions"
        />
        {missionsView.isPending ? (
          <VStack className="items-center justify-center py-24">
            <Spinner size="small" />
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
          <>
            <XpHero progress={missionsView.data.progress} />
            <VStack className="gap-2 px-5 pt-1">
              <Text className="py-0.5 font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                Near you
              </Text>
              {missionsView.data.missions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </VStack>
          </>
        )}
      </VStack>
    </ScrollView>
  );
}

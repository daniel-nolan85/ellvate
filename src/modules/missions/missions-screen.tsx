import { useState } from 'react';
import { ScrollView } from 'react-native';

import { SearchSheet } from '@/src/components/shared/search-sheet';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { MissionCard } from './mission-card';
import { MissionComposer } from './mission-composer';
import { useCreateMission, useMissionsView } from './use-missions';
import { XpHero } from './xp-hero';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

interface MissionsScreenProps {
  readonly onOpenMission?: (missionId: string) => void;
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

export function MissionsScreen({
  onOpenMission,
}: MissionsScreenProps) {
  const missionsView = useMissionsView();
  const createMission = useCreateMission();
  const [composing, setComposing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        <VStack className="gap-4">
          <ScreenTitle
            eyebrow="Explore & earn"
            onSearch={() => setIsSearching(true)}
            right={<CreateButton onPress={() => setComposing(true)} />}
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
              {missionsView.data.missions.length === 0 ? (
                <Text className="py-2 text-muted-foreground" size="sm">
                  No missions yet. Tap + to create the first one.
                </Text>
              ) : (
                missionsView.data.missions.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onOpen={onOpenMission}
                  />
                ))
              )}
            </VStack>
          </>
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
                icon: draft.icon,
                newMedia: draft.newMedia,
                scheduledFor: draft.scheduledFor,
                stopsTotal: draft.stopsTotal,
                title: draft.title,
                xp: draft.xp,
              },
              { onSuccess: () => setComposing(false) },
            )
          }
        />
      </Sheet>

      <SearchSheet
        getKey={(mission) => mission.id}
        getSubtitle={(mission) => mission.description}
        getTitle={(mission) => mission.title}
        items={missionsView.data?.missions ?? []}
        onClose={() => setIsSearching(false)}
        onSelect={(mission) => onOpenMission?.(mission.id)}
        placeholder="Search missions"
        visible={isSearching}
      />
    </>
  );
}

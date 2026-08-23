import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { router, type Href } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { SearchSheet } from '@/src/components/shared/search-sheet';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { PetitionComposer } from './petition-composer';
import { PetitionRow } from './petition-row';
import { PetitionsGateWall } from './petitions-gate-wall';
import type { PetitionStatus } from './petitions-types';
import { useCreatePetition, usePetitionsGate, usePetitionsPage } from './use-petitions';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

const STATUS_TABS: readonly { readonly value: PetitionStatus; readonly label: string }[] = [
  { label: 'In progress', value: 'open' },
  { label: 'Succeeded', value: 'succeeded' },
  { label: 'Expired', value: 'expired' },
];

function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center py-3" testID="petitions-load-more">
      <Spinner size="small" />
    </View>
  );
}

function CreateButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button className="rounded-full bg-accent px-4" onPress={onPress} size="sm" testID="petitions-add">
      <Icon color={COLOR_ACCENT_FOREGROUND} name="Add" size={14} />
      <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
        Start
      </ButtonText>
    </Button>
  );
}

export function PetitionsScreen() {
  const gate = usePetitionsGate();
  const [status, setStatus] = useState<PetitionStatus>('open');
  const petitions = usePetitionsPage(status);
  const createPetition = useCreatePetition();
  const [composing, setComposing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const items = petitions.data?.pages.flatMap((page) => page.petitions) ?? [];
  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: petitions.fetchNextPage,
      hasNextPage: petitions.hasNextPage,
      isFetchingNextPage: petitions.isFetchingNextPage,
    },
  ]);

  if (gate.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner size="xlarge" />
      </View>
    );
  }

  if (gate.data && !gate.data.unlocked) {
    return <PetitionsGateWall usersNeeded={gate.data.usersNeeded} />;
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="pb-[130px]"
        onScroll={onScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
      >
        <VStack space="md">
          <ScreenTitle
            eyebrow="Raise it with the HOA"
            onSearch={() => setIsSearching(true)}
            right={<CreateButton onPress={() => setComposing(true)} />}
            title="Petitions"
          />

          <HStack className="px-5" space="sm">
            {STATUS_TABS.map((tab) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: status === tab.value }}
                className={`rounded-full px-3.5 py-2 ${status === tab.value ? 'bg-accent' : 'bg-secondary'}`}
                key={tab.value}
                onPress={() => setStatus(tab.value)}
                testID={`petitions-tab-${tab.value}`}
              >
                <Text
                  className={`font-inter-medium text-[13px] ${
                    status === tab.value ? 'text-accent-foreground' : 'text-content'
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </HStack>

          {petitions.isPending ? (
            <Box className="items-center justify-center py-24">
              <Spinner size="xlarge" />
            </Box>
          ) : petitions.isError ? (
            <VStack className="items-center px-5 py-24" space="md">
              <Text className="text-muted-foreground" size="sm">
                Could not load petitions.
              </Text>
              <Button
                action="secondary"
                onPress={() => void petitions.refetch()}
                size="sm"
                variant="outline"
              >
                <ButtonText>Retry</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack className="px-5" space="sm">
              {items.length === 0 ? (
                <Text className="py-2 text-muted-foreground" size="sm">
                  {status === 'open'
                    ? 'No open petitions right now. Tap Start to raise something with the HOA.'
                    : status === 'succeeded'
                      ? 'No petitions have succeeded yet.'
                      : 'No petitions have expired.'}
                </Text>
              ) : (
                <>
                  {items.map((petition) => (
                    <PetitionRow
                      key={petition.id}
                      onOpen={(id) => router.push(`/petition/${id}` as Href)}
                      petition={petition}
                    />
                  ))}
                  {petitions.hasNextPage ? (
                    <LoadMoreFooter isLoading={petitions.isFetchingNextPage} />
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
        <PetitionComposer
          isSubmitting={createPetition.isPending}
          onDismiss={() => setComposing(false)}
          onSubmit={(draft) =>
            createPetition.mutate(draft, { onSuccess: () => setComposing(false) })
          }
          totalUsers={gate.data?.totalUsers ?? 0}
        />
      </Sheet>

      <SearchSheet
        getKey={(petition) => petition.id}
        getSubtitle={(petition) => petition.description}
        getTitle={(petition) => petition.title}
        items={items}
        onClose={() => setIsSearching(false)}
        onSelect={(petition) => router.push(`/petition/${petition.id}` as Href)}
        placeholder="Search petitions"
        visible={isSearching}
      />
    </>
  );
}

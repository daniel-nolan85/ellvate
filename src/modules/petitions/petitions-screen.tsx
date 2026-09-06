import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { router, type Href } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';
import { ApiError } from '@/src/services/api';

import { PetitionComposer } from './petition-composer';
import { PetitionRow } from './petition-row';
import { PetitionsGateWall } from './petitions-gate-wall';
import type { Petition, PetitionStatus } from './petitions-types';
import {
  useCreatePetition,
  usePetitionsGate,
  usePetitionsPage,
} from './use-petitions';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

const STATUS_TABS: readonly {
  readonly value: PetitionStatus;
  readonly label: string;
}[] = [
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
    <Button
      className="rounded-full bg-accent px-4"
      onPress={onPress}
      size="sm"
      testID="petitions-add"
    >
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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const items = petitions.data?.pages.flatMap((page) => page.petitions) ?? [];

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
      {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
          ActivitySectionList for why: this screen pairs a status-tab row
          with a growing list, the exact shape that caused My Activity's
          "All" filter pills to corrupt under enough simultaneous content.
          Only rows actually on/near screen mount as real native views here,
          no matter how many petitions load. */}
      <FlatList<Petition>
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        data={petitions.isPending || petitions.isError ? [] : items}
        keyExtractor={(petition) => petition.id}
        ListEmptyComponent={
          petitions.isPending ? (
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
            <Text className="px-5 py-2 text-muted-foreground" size="sm">
              {status === 'open'
                ? 'No open petitions right now. Tap Start to raise something with the HOA.'
                : status === 'succeeded'
                  ? 'No petitions have succeeded yet.'
                  : 'No petitions have expired.'}
            </Text>
          )
        }
        ListFooterComponent={
          items.length === 0 ? null : petitions.hasNextPage ? (
            <LoadMoreFooter isLoading={petitions.isFetchingNextPage} />
          ) : (
            <AllCaughtUp />
          )
        }
        ListHeaderComponent={
          <VStack className="pb-3" space="md">
            <ScreenTitle
              eyebrow="Raise it with the HOA"
              onSearch={() => router.push('/search')}
              right={
                <CreateButton
                  onPress={() => {
                    setSubmitError(null);
                    setComposing(true);
                  }}
                />
              }
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
                      status === tab.value
                        ? 'text-accent-foreground'
                        : 'text-content'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </VStack>
        }
        onEndReached={() => {
          if (petitions.hasNextPage && !petitions.isFetchingNextPage) {
            void petitions.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <View className="mx-5 mb-2">
            <PetitionRow
              onOpen={(id) => router.push(`/petition/${id}` as Href)}
              petition={item}
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      <Sheet
        onClose={() => {
          setComposing(false);
          setSubmitError(null);
        }}
        visible={composing}
      >
        <PetitionComposer
          errorMessage={submitError}
          isSubmitting={createPetition.isPending}
          onDismiss={() => setComposing(false)}
          onSubmit={(draft) => {
            setSubmitError(null);
            createPetition.mutate(draft, {
              onError: (error) =>
                setSubmitError(
                  error instanceof ApiError
                    ? error.message
                    : 'Couldn’t start your petition. Try again.',
                ),
              onSuccess: () => setComposing(false),
            });
          }}
          totalUsers={gate.data?.totalUsers ?? 0}
        />
      </Sheet>
    </>
  );
}

import { useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { EmptyState } from '@/src/components/shared/empty-state';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import {
  ServiceCategoryChips,
  type ServiceCategoryFilter,
} from './service-category-chips';
import { ServiceComposer, type ServiceComposerDraft } from './service-composer';
import { ServiceListingCard } from './service-listing-card';
import { useCreateServiceListing, useServicesView } from './use-services';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center py-3" testID="services-load-more">
      <Spinner size="small" />
    </View>
  );
}

interface ServicesScreenProps {
  readonly onOpenListing?: (listingId: string) => void;
  // Rendered right after ScreenTitle, before the category chips -- lets
  // DirectoryScreen slot its section switcher in below the avatar/search/
  // bell row without this screen needing to know anything about it.
  readonly headerExtra?: ReactNode;
}

export function ServicesScreen({ headerExtra, onOpenListing }: ServicesScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] =
    useState<ServiceCategoryFilter>('all');
  const [isComposing, setIsComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const services = useServicesView(
    activeCategory === 'all' ? undefined : activeCategory,
  );
  const createListing = useCreateServiceListing();

  const listings = services.data?.pages.flatMap((page) => page.listings) ?? [];

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleCreate = (draft: ServiceComposerDraft) => {
    createListing.mutate(draft, {
      onSuccess: () => {
        setIsComposing(false);
        showToast('Listed!');
      },
    });
  };

  return (
    <View className="flex-1">
      {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
          ActivitySectionList for why: this screen pairs a filter-chip row
          (ServiceCategoryChips) with a growing list, the exact shape that
          caused My Activity's "All" filter pills to corrupt under enough
          simultaneous content. Only rows actually on/near screen mount as
          real native views here, no matter how many listings load. */}
      <FlatList
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        data={listings}
        keyExtractor={(listing) => listing.id}
        ListEmptyComponent={
          services.isPending ? (
            <VStack className="items-center py-16">
              <Spinner size="xlarge" />
            </VStack>
          ) : services.isError ? (
            <VStack className="items-center py-16" space="sm">
              <Text className="text-text-muted" size="sm">
                Couldn&apos;t load listings.
              </Text>
              <Button
                action="secondary"
                className="rounded-full"
                onPress={() => void services.refetch()}
                size="sm"
                variant="outline"
              >
                <ButtonText className="font-inter-semibold text-[13px]">
                  Retry
                </ButtonText>
              </Button>
            </VStack>
          ) : (
            <EmptyState
              heading="No listings yet"
              icon="Store"
              subtext="Be the first to list a business in this category."
            />
          )
        }
        ListFooterComponent={
          listings.length === 0 ? null : services.hasNextPage ? (
            <LoadMoreFooter isLoading={services.isFetchingNextPage} />
          ) : (
            <AllCaughtUp />
          )
        }
        ListHeaderComponent={
          <VStack className="pb-3" space="md">
            <ScreenTitle
              eyebrow="Local services"
              onSearch={() => router.push('/search')}
              right={
                <Button
                  className="rounded-full bg-accent px-4"
                  onPress={() => setIsComposing(true)}
                  size="sm"
                  testID="services-add"
                >
                  <Icon color={COLOR_ACCENT_FOREGROUND} name="Add" size={14} />
                  <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
                    List
                  </ButtonText>
                </Button>
              }
              title="Services"
            />
            {headerExtra}
            <ServiceCategoryChips
              active={activeCategory}
              onSelect={setActiveCategory}
            />
          </VStack>
        }
        onEndReached={() => {
          if (services.hasNextPage && !services.isFetchingNextPage) {
            void services.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={() => void services.refetch()}
        refreshing={services.isRefetching}
        renderItem={({ item }) => (
          <View className="mx-5 mb-2">
            <ServiceListingCard listing={item} onOpen={onOpenListing} />
          </View>
        )}
      />

      <Sheet onClose={() => setIsComposing(false)} visible={isComposing}>
        {(maxContentHeight) => (
          <>
            <ServiceComposer
              isSubmitting={createListing.isPending}
              maxContentHeight={maxContentHeight}
              onDismiss={() => setIsComposing(false)}
              onSubmit={handleCreate}
            />
            {createListing.isError ? (
              <Text className="px-5 pb-2 text-destructive" size="xs">
                Couldn&apos;t publish your listing. Please try again.
              </Text>
            ) : null}
          </>
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

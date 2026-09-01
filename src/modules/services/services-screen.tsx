import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { GlobalSearchSheet } from '@/src/components/shared/global-search-sheet';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { ServiceCategoryChips, type ServiceCategoryFilter } from './service-category-chips';
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
}

export function ServicesScreen({ onOpenListing }: ServicesScreenProps = {}) {
  const [activeCategory, setActiveCategory] = useState<ServiceCategoryFilter>('all');
  const [isComposing, setIsComposing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const services = useServicesView(
    activeCategory === 'all' ? undefined : activeCategory,
  );
  const createListing = useCreateServiceListing();

  const listings = services.data?.pages.flatMap((page) => page.listings) ?? [];

  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: services.fetchNextPage,
      hasNextPage: services.hasNextPage,
      isFetchingNextPage: services.isFetchingNextPage,
    },
  ]);

  const handleCreate = (draft: ServiceComposerDraft) => {
    createListing.mutate(draft, {
      onSuccess: () => setIsComposing(false),
    });
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        <VStack space="md">
          <ScreenTitle
            eyebrow="Local businesses"
            onSearch={() => setIsSearching(true)}
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
          <ServiceCategoryChips active={activeCategory} onSelect={setActiveCategory} />
          {services.isPending ? (
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
          ) : listings.length === 0 ? (
            <VStack className="items-center px-10 py-16" space="xs">
              <Icon color="rgb(169,156,139)" name="Store" size={28} />
              <Text className="text-center font-inter-semibold text-content" size="sm">
                No listings yet
              </Text>
              <Text className="text-center text-text-muted" size="xs">
                Be the first to list a business in this category.
              </Text>
            </VStack>
          ) : (
            <VStack className="px-5" space="sm">
              {listings.map((listing) => (
                <ServiceListingCard
                  key={listing.id}
                  listing={listing}
                  onOpen={onOpenListing}
                />
              ))}
              {services.hasNextPage ? (
                <LoadMoreFooter isLoading={services.isFetchingNextPage} />
              ) : (
                <AllCaughtUp />
              )}
            </VStack>
          )}
        </VStack>
      </ScrollView>

      <Sheet onClose={() => setIsComposing(false)} visible={isComposing}>
        <ServiceComposer
          isSubmitting={createListing.isPending}
          onDismiss={() => setIsComposing(false)}
          onSubmit={handleCreate}
        />
        {createListing.isError ? (
          <Text className="px-5 pb-2 text-destructive" size="xs">
            Couldn&apos;t publish your listing. Please try again.
          </Text>
        ) : null}
      </Sheet>

      <GlobalSearchSheet onClose={() => setIsSearching(false)} visible={isSearching} />
    </>
  );
}

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
  BusinessCategoryChips,
  type BusinessCategoryFilter,
} from './business-category-chips';
import { BusinessComposer, type BusinessComposerDraft } from './business-composer';
import { BusinessListingCard } from './business-listing-card';
import { useBusinessesView, useCreateBusinessListing } from './use-businesses';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center py-3" testID="businesses-load-more">
      <Spinner size="small" />
    </View>
  );
}

interface BusinessesScreenProps {
  readonly onOpenListing?: (listingId: string) => void;
  // Rendered right after ScreenTitle, before the category chips -- lets
  // DirectoryScreen slot its section switcher in below the avatar/search/
  // bell row without this screen needing to know anything about it.
  readonly headerExtra?: ReactNode;
}

interface BusinessToast {
  readonly message: string;
  // 'pending' gets a visually distinct treatment (a different icon, longer
  // on screen) -- a listing that needs review is a meaningfully different
  // outcome from one that's already live, and the owner should actually
  // register that, not just see the same generic confirmation.
  readonly variant: 'live' | 'pending';
}

export function BusinessesScreen({ headerExtra, onOpenListing }: BusinessesScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] =
    useState<BusinessCategoryFilter>('all');
  const [isComposing, setIsComposing] = useState(false);
  const [toast, setToast] = useState<BusinessToast | null>(null);
  const businesses = useBusinessesView(
    activeCategory === 'all' ? undefined : activeCategory,
  );
  const createListing = useCreateBusinessListing();

  const listings = businesses.data?.pages.flatMap((page) => page.listings) ?? [];

  const showToast = (next: BusinessToast) => {
    setToast(next);
    setTimeout(() => setToast(null), next.variant === 'pending' ? 3500 : 2200);
  };

  const handleCreate = (draft: BusinessComposerDraft) => {
    createListing.mutate(draft, {
      onSuccess: (result) => {
        setIsComposing(false);
        showToast(
          result.listing.verificationStatus === 'verified'
            ? { message: 'Listed! Your business is live.', variant: 'live' }
            : {
                message:
                  'Listed! Pending review — visible only to you until approved.',
                variant: 'pending',
              },
        );
      },
    });
  };

  return (
    <View className="flex-1">
      {/* FlatList, not a ScrollView + `.map()` -- see ServicesScreen's
          identical comment for why. */}
      <FlatList
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        data={listings}
        keyExtractor={(listing) => listing.id}
        ListEmptyComponent={
          businesses.isPending ? (
            <VStack className="items-center py-16">
              <Spinner size="xlarge" />
            </VStack>
          ) : businesses.isError ? (
            <VStack className="items-center py-16" space="sm">
              <Text className="text-text-muted" size="sm">
                Couldn&apos;t load listings.
              </Text>
              <Button
                action="secondary"
                className="rounded-full"
                onPress={() => void businesses.refetch()}
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
          listings.length === 0 ? null : businesses.hasNextPage ? (
            <LoadMoreFooter isLoading={businesses.isFetchingNextPage} />
          ) : (
            <AllCaughtUp />
          )
        }
        ListHeaderComponent={
          <VStack className="pb-3" space="md">
            <ScreenTitle
              eyebrow="Local businesses"
              onSearch={() => router.push('/search')}
              right={
                <Button
                  className="rounded-full bg-accent px-4"
                  onPress={() => setIsComposing(true)}
                  size="sm"
                  testID="businesses-add"
                >
                  <Icon color={COLOR_ACCENT_FOREGROUND} name="Add" size={14} />
                  <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
                    List
                  </ButtonText>
                </Button>
              }
              title="Businesses"
            />
            {headerExtra}
            <BusinessCategoryChips
              active={activeCategory}
              onSelect={setActiveCategory}
            />
          </VStack>
        }
        onEndReached={() => {
          if (businesses.hasNextPage && !businesses.isFetchingNextPage) {
            void businesses.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={() => void businesses.refetch()}
        refreshing={businesses.isRefetching}
        renderItem={({ item }) => (
          <View className="mx-5 mb-2">
            <BusinessListingCard listing={item} onOpen={onOpenListing} />
          </View>
        )}
      />

      <Sheet onClose={() => setIsComposing(false)} visible={isComposing}>
        {(maxContentHeight) => (
          <>
            <BusinessComposer
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
          className={`absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] px-4 py-3 ${
            toast.variant === 'pending' ? 'bg-accent' : 'bg-primary'
          }`}
          style={{ bottom: insets.bottom + 96 }}
        >
          <Icon
            color="rgb(250,250,250)"
            name={toast.variant === 'pending' ? 'Clock' : 'CheckCircle'}
            size={16}
          />
          <Text
            className={`flex-1 text-[14px] ${
              toast.variant === 'pending'
                ? 'text-accent-foreground'
                : 'text-primary-foreground'
            }`}
          >
            {toast.message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

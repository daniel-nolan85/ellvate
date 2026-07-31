import { Image, Pressable, View } from 'react-native';

import { Badge } from '@/src/components/ui/badge';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CATEGORY_CHIP_ACTIVE_TREATMENT } from '@/src/lib/category-accent';
import { BookmarkButton } from '@/src/modules/bookmarks';

import {
  SERVICE_CATEGORY_LABEL,
  serviceCategoryAccent,
  serviceCategoryIcon,
  serviceCategoryIconColor,
} from './service-category';
import type { ServiceListing } from './use-services';

const COLOR_STAR = 'rgb(217,123,41)';
const COLOR_MUTED = 'rgb(169,156,139)';

interface ServiceListingCardProps {
  readonly listing: ServiceListing;
  readonly onOpen?: (listingId: string) => void;
}

function RatingSummary({ listing }: { readonly listing: ServiceListing }) {
  if (listing.averageRating === null) {
    return (
      <Text className="shrink-0 text-text-muted" numberOfLines={1} size="xs">
        No reviews yet
      </Text>
    );
  }
  return (
    <HStack className="shrink-0 items-center gap-1">
      <Icon color={COLOR_STAR} fill={COLOR_STAR} name="Star" size={12} />
      <Text className="font-inter-semibold text-[12px] text-content">
        {listing.averageRating.toFixed(1)}
      </Text>
      <Text className="text-text-muted" size="xs">
        ({listing.reviewCount})
      </Text>
    </HStack>
  );
}

export function ServiceListingCard({ listing, onOpen }: ServiceListingCardProps) {
  const treatment = CATEGORY_CHIP_ACTIVE_TREATMENT[serviceCategoryAccent(listing.category)];
  const logo = listing.logo;

  return (
    <Pressable
      accessibilityLabel={`Open listing: ${listing.businessName}`}
      accessibilityRole="button"
      className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-4 shadow-card"
      onPress={() => onOpen?.(listing.id)}
    >
      <HStack className="items-center gap-3">
        {logo ? (
          <Image
            className="h-11 w-11 rounded-[14px]"
            resizeMode="cover"
            source={{ uri: logo.url }}
          />
        ) : (
          <View className={`h-11 w-11 items-center justify-center rounded-[14px] ${treatment.bg}`}>
            <Icon
              color={serviceCategoryIconColor(listing.category)}
              name={serviceCategoryIcon(listing.category)}
              size={20}
            />
          </View>
        )}
        <VStack className="flex-1 gap-1">
          <Text className="font-inter-bold text-[15px] leading-[20px] tracking-[-0.15px] text-content">
            {listing.businessName}
          </Text>
          <Text className="text-muted-foreground" numberOfLines={2} size="xs">
            {listing.description}
          </Text>
        </VStack>
        <BookmarkButton targetId={listing.id} targetType="service" />
      </HStack>
      <VStack className="gap-1.5">
        <HStack className="items-center gap-2">
          <Badge variant={serviceCategoryAccent(listing.category)}>
            {SERVICE_CATEGORY_LABEL[listing.category]}
          </Badge>
          <RatingSummary listing={listing} />
        </HStack>
        {listing.serviceArea ? (
          <HStack className="items-center gap-1">
            <Icon color={COLOR_MUTED} name="Globe" size={11} />
            <Text className="flex-1 text-text-muted" numberOfLines={1} size="xs">
              {listing.serviceArea}
            </Text>
          </HStack>
        ) : null}
      </VStack>
    </Pressable>
  );
}

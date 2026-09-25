import { Image, Pressable, View } from 'react-native';

import { EditedMark } from '@/src/components/shared/edited-mark';
import { Badge } from '@/src/components/ui/badge';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CATEGORY_CHIP_ACTIVE_TREATMENT } from '@/src/lib/category-accent';
import { BookmarkButton } from '@/src/modules/bookmarks';
import { useSession } from '@/src/platform/session';

import {
  BUSINESS_CATEGORY_LABEL,
  businessCategoryAccent,
  businessCategoryIcon,
  businessCategoryIconColor,
} from './business-category';
import type { BusinessListing } from './use-businesses';

const COLOR_MUTED = 'rgb(169,156,139)';
const COLOR_SPECIAL = 'rgb(181,80,44)';
const COLOR_STAR = 'rgb(217,123,41)';

interface BusinessListingCardProps {
  readonly listing: BusinessListing;
  readonly onOpen?: (listingId: string) => void;
}

function RatingSummary({ listing }: { readonly listing: BusinessListing }) {
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

export function BusinessListingCard({ listing, onOpen }: BusinessListingCardProps) {
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const treatment = CATEGORY_CHIP_ACTIVE_TREATMENT[businessCategoryAccent(listing.category)];
  const logo = listing.logo;
  // RLS (and the memory-mode equivalent) already keeps a pending listing
  // from ever reaching anyone but its own author, so this badge is purely
  // informational for the one viewer who could possibly see it pending.
  const isOwner = listing.author.id === userId;

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
              color={businessCategoryIconColor(listing.category)}
              name={businessCategoryIcon(listing.category)}
              size={20}
            />
          </View>
        )}
        <VStack className="flex-1 gap-1">
          <HStack className="items-center gap-1">
            <Text className="font-inter-bold text-[15px] leading-[20px] tracking-[-0.15px] text-content">
              {listing.businessName}
            </Text>
            <EditedMark editedAt={listing.editedAt} />
          </HStack>
          <Text className="text-muted-foreground" numberOfLines={2} size="xs">
            {listing.description}
          </Text>
        </VStack>
        <BookmarkButton targetId={listing.id} targetType="business" />
      </HStack>
      <VStack className="gap-1.5">
        <HStack className="items-center gap-2">
          <Badge variant={businessCategoryAccent(listing.category)}>
            {BUSINESS_CATEGORY_LABEL[listing.category]}
          </Badge>
          {isOwner && listing.verificationStatus === 'pending' ? (
            <Badge variant="muted">Pending review</Badge>
          ) : null}
          <RatingSummary listing={listing} />
        </HStack>
        {listing.currentSpecial ? (
          <HStack className="items-center gap-1">
            <Icon color={COLOR_SPECIAL} name="Sparkles" size={11} />
            <Text
              className="flex-1 font-inter-medium text-[rgb(181,80,44)]"
              numberOfLines={1}
              size="xs"
            >
              {listing.currentSpecial}
            </Text>
          </HStack>
        ) : null}
        {listing.address ? (
          <HStack className="items-center gap-1">
            <Icon color={COLOR_MUTED} name="Globe" size={11} />
            <Text className="flex-1 text-text-muted" numberOfLines={1} size="xs">
              {listing.address}
            </Text>
          </HStack>
        ) : null}
      </VStack>
    </Pressable>
  );
}

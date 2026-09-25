import { Pressable } from 'react-native';

import { AdminBadge } from '@/src/components/shared/admin-badge';
import { EditedMark } from '@/src/components/shared/edited-mark';
import { Avatar } from '@/src/components/ui/avatar';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';

import type { BusinessListingReview } from './use-business-listing-reviews';

const COLOR_STAR = 'rgb(217,123,41)';
const COLOR_MUTED_STAR = 'rgb(214,206,196)';

function StarRow({ rating }: { readonly rating: number }) {
  return (
    <HStack className="gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Icon
          color={value <= rating ? COLOR_STAR : COLOR_MUTED_STAR}
          fill={value <= rating ? COLOR_STAR : 'none'}
          key={value}
          name="Star"
          size={12}
        />
      ))}
    </HStack>
  );
}

interface BusinessListingReviewItemProps {
  readonly review: BusinessListingReview;
  readonly onActions?: (review: BusinessListingReview) => void;
  readonly onOpenAuthor: (authorId: string, name: string) => void;
}

export function BusinessListingReviewItem({
  onActions,
  onOpenAuthor,
  review,
}: BusinessListingReviewItemProps) {
  return (
    <HStack className="gap-3" testID={`business-listing-review-${review.id}`}>
      <Pressable
        accessibilityLabel={`Open ${review.author.name}'s profile`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => onOpenAuthor(review.author.id, review.author.name)}
      >
        <Avatar name={review.author.name} size="sm" src={review.author.avatarUrl ?? undefined} />
      </Pressable>
      <VStack className="flex-1 gap-1">
        <HStack className="items-center justify-between">
          <VStack className="gap-0.5">
            <Pressable
              className="flex-row items-center gap-1"
              onPress={() => onOpenAuthor(review.author.id, review.author.name)}
            >
              <Text className="font-inter-semibold text-[13px] text-content">
                {review.author.name}
              </Text>
              <AdminBadge isAdmin={review.author.isAdmin} />
            </Pressable>
            <StarRow rating={review.rating} />
          </VStack>
          <HStack className="items-center gap-2">
            <Text className="text-[11px] text-text-muted">
              {formatRelativeTime(review.createdAt)}
            </Text>
            <EditedMark editedAt={review.editedAt} />
            {onActions ? (
              <Pressable
                accessibilityLabel="Review actions"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onActions(review)}
              >
                <Icon color="rgb(169,156,139)" name="ThreeDots" size={14} />
              </Pressable>
            ) : null}
          </HStack>
        </HStack>
        {review.body ? (
          <Text className="text-[14px] leading-[20px] text-muted-foreground">
            {review.body}
          </Text>
        ) : null}
      </VStack>
    </HStack>
  );
}

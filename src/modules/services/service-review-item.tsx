import { Pressable } from 'react-native';

import { Avatar } from '@/src/components/ui/avatar';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';

import type { ServiceReview } from './use-service-reviews';

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

interface ServiceReviewItemProps {
  readonly review: ServiceReview;
  readonly onActions?: (review: ServiceReview) => void;
}

export function ServiceReviewItem({ review, onActions }: ServiceReviewItemProps) {
  return (
    <HStack className="gap-3" testID={`service-review-${review.id}`}>
      <Avatar name={review.author.name} size="sm" src={review.author.avatarUrl ?? undefined} />
      <VStack className="flex-1 gap-1">
        <HStack className="items-center justify-between">
          <VStack className="gap-0.5">
            <Text className="font-inter-semibold text-[13px] text-content">
              {review.author.name}
            </Text>
            <StarRow rating={review.rating} />
          </VStack>
          <HStack className="items-center gap-2">
            <Text className="text-[11px] text-text-muted">
              {formatRelativeTime(review.createdAt)}
            </Text>
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
        <Text className="text-[14px] leading-[20px] text-muted-foreground">
          {review.body}
        </Text>
      </VStack>
    </HStack>
  );
}

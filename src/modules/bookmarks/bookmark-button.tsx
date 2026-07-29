import { Pressable } from 'react-native';

import { Icon } from '@/src/components/ui/icon';

import { useIsBookmarked, useToggleBookmark, type BookmarkTargetType } from './use-bookmarks';

const COLOR_ACCENT = 'rgb(181,80,44)';
const COLOR_TEXT_SUBTLE = 'rgb(169,156,139)';

interface BookmarkButtonProps {
  readonly targetType: BookmarkTargetType;
  readonly targetId: string;
  readonly size?: number;
  // Overrides for cards with a non-default background (e.g. the dark
  // FeaturedEventCard) where the default gray/accent pairing wouldn't read
  // clearly.
  readonly inactiveColor?: string;
  readonly activeColor?: string;
}

// A small reusable bookmark toggle, dropped into PostCard/event cards/
// MissionCard. Reads from the shared bookmark-ids cache (useIsBookmarked)
// rather than firing its own request per card.
export function BookmarkButton({
  activeColor = COLOR_ACCENT,
  inactiveColor = COLOR_TEXT_SUBTLE,
  size = 16,
  targetId,
  targetType,
}: BookmarkButtonProps) {
  const bookmarked = useIsBookmarked(targetType, targetId);
  const toggleBookmark = useToggleBookmark();

  return (
    <Pressable
      accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
      accessibilityRole="button"
      hitSlop={8}
      onPress={(event) => {
        // WHY: this button is nested inside each card's own "open" Pressable
        // (list rows, PostCard, MissionCard) — without stopping propagation,
        // bookmarking would also navigate into the item, which is especially
        // disruptive when bookmarking several items in a row from a feed.
        event.stopPropagation();
        toggleBookmark.mutate({ targetId, targetType });
      }}
    >
      <Icon
        color={bookmarked ? activeColor : inactiveColor}
        fill={bookmarked ? activeColor : 'none'}
        name="Bookmark"
        size={size}
      />
    </Pressable>
  );
}

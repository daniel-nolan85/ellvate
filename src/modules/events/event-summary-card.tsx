import { Pressable } from 'react-native';

import { EditedMark } from '@/src/components/shared/edited-mark';
import { Badge } from '@/src/components/ui/badge';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { categoryAccent } from '@/src/lib/category-accent';
import { BookmarkButton } from '@/src/modules/bookmarks';

import type { CommunityEvent } from './events-types';

interface EventSummaryCardProps {
  readonly event: CommunityEvent;
  readonly onOpen?: (eventId: string) => void;
}

// A compact, read-only event summary for use inside a modal/Sheet (the
// activity hub and bookmarks screen both tap into a row and pop this up).
// The whole card is tappable to open the full event, matching how PostCard
// and MissionCard behave in the same sheets. Navigation is left entirely to
// the caller (via onOpen) rather than done internally, so the caller can
// close its Sheet before navigating away.
export function EventSummaryCard({ event, onOpen }: EventSummaryCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Open event: ${event.title}`}
      accessibilityRole="button"
      onPress={() => onOpen?.(event.id)}
    >
      <VStack className="gap-3 px-5 pb-6" space="sm">
        <HStack className="items-center justify-between gap-2">
          <Text className="flex-1 font-inter-bold text-[18px] text-content">
            {event.title}
          </Text>
          {event.featured ? <Badge variant="amber">Featured</Badge> : null}
          <BookmarkButton targetId={event.id} targetType="event" />
        </HStack>
        <HStack className="items-center gap-1.5">
          <Icon color="rgb(120,108,94)" name="CalendarDays" size={14} />
          <Text className="text-text-muted" size="sm">
            {event.dayLabel} {event.dateLabel} · {event.timeLabel}
          </Text>
          <EditedMark editedAt={event.editedAt} />
        </HStack>
        <Text className="text-text-muted" size="sm">
          {event.place}
        </Text>
        <Badge variant={categoryAccent(event.tag)}>{event.tag}</Badge>
        <Text className="text-text-muted" size="sm">
          {event.going} going
        </Text>
      </VStack>
    </Pressable>
  );
}

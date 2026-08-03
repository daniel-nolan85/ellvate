import { Pressable } from 'react-native';

import { EditedMark } from '@/src/components/shared/edited-mark';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { BookmarkButton } from '@/src/modules/bookmarks';

import type { CommunityEvent } from './events-types';

interface EventRowProps {
  readonly event: CommunityEvent;
  readonly onToggleJoin: (eventId: string) => void;
  readonly onOpen?: (eventId: string) => void;
}

export function EventRow({ event, onOpen, onToggleJoin }: EventRowProps) {
  return (
    <Pressable
      accessibilityLabel={`Open event: ${event.title}`}
      accessibilityRole="button"
      onPress={() => onOpen?.(event.id)}
    >
      <HStack className="items-center gap-3 rounded-[18px] border border-surface-hairline bg-paper p-3.5 shadow-card">
        <VStack className="w-12 items-center rounded-[14px] bg-accent-subtle py-[9px]" space="xs">
          <Text className="font-inter-bold text-[10px] leading-[12px] tracking-[0.5px] text-accent">
            {event.dayLabel}
          </Text>
          <Text className="font-inter-bold text-[19px] leading-[20px] text-accent">
            {event.dateLabel}
          </Text>
        </VStack>
        <VStack className="min-w-0 flex-1" space="xs">
          <Text className="font-inter-bold tracking-[-0.14px] text-content" size="sm">
            {event.title}
          </Text>
          <HStack className="items-center" space="xs">
            <Text className="text-muted-foreground" size="xs">
              {event.timeLabel} · {event.place}
            </Text>
            <EditedMark editedAt={event.editedAt} />
          </HStack>
          <Text className="text-text-subtle" size="xs">
            {event.going} going
          </Text>
        </VStack>
        <BookmarkButton targetId={event.id} targetType='event' />
        <Pressable
          accessibilityRole="button"
          className={`h-[34px] w-[34px] items-center justify-center rounded-full ${
            event.joined ? 'bg-success' : 'bg-secondary'
          }`}
          onPress={(pressEvent) => {
            pressEvent.stopPropagation();
            onToggleJoin(event.id);
          }}
        >
          <Icon
            color={event.joined ? 'rgb(255,255,255)' : 'rgb(37,30,23)'}
            name={event.joined ? 'Check' : 'Add'}
            size={16}
          />
        </Pressable>
      </HStack>
    </Pressable>
  );
}

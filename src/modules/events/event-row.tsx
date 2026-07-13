import { Pressable } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import type { CommunityEvent } from './events-types';

interface EventRowProps {
  readonly event: CommunityEvent;
  readonly onToggleJoin: (eventId: string) => void;
}

export function EventRow({ event, onToggleJoin }: EventRowProps) {
  return (
    <HStack className="items-center gap-3 rounded-[18px] border border-line p-3.5">
      <VStack className="w-12 items-center rounded-[14px] bg-indigo-subtle py-[9px]" space="xs">
        <Text className="font-inter-bold text-[10px] leading-[12px] tracking-[0.5px] text-indigo">
          {event.dayLabel}
        </Text>
        <Text className="font-inter-bold text-[19px] leading-[20px] text-indigo">
          {event.dateLabel}
        </Text>
      </VStack>
      <VStack className="min-w-0 flex-1" space="xs">
        <Text className="font-inter-bold tracking-[-0.14px] text-content" size="sm">
          {event.title}
        </Text>
        <Text className="text-muted-foreground" size="xs">
          {event.timeLabel} · {event.place}
        </Text>
        <Text className="text-text-subtle" size="xs">
          {event.going} going
        </Text>
      </VStack>
      <Pressable
        accessibilityRole="button"
        className={`h-[34px] w-[34px] items-center justify-center rounded-full ${
          event.joined ? 'bg-success' : 'bg-secondary'
        }`}
        onPress={() => onToggleJoin(event.id)}
      >
        <Icon
          color={event.joined ? 'rgb(255,255,255)' : 'rgb(10,10,10)'}
          name={event.joined ? 'Check' : 'Add'}
          size={16}
        />
      </Pressable>
    </HStack>
  );
}

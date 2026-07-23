import { Pressable } from 'react-native';

import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Box } from '@/src/components/ui/box';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { BookmarkButton } from '@/src/modules/bookmarks';

import type { CommunityEvent } from './events-types';

interface FeaturedEventCardProps {
  readonly event: CommunityEvent;
  readonly onToggleJoin: (eventId: string) => void;
  readonly onOpen?: (eventId: string) => void;
}

const formatDayLabel = (dayLabel: string) =>
  dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).toLowerCase();

function IndigoGlow() {
  return (
    <Box
      className="absolute right-[-40px] top-[-50px] h-[190px] w-[190px]"
      pointerEvents="none"
    >
      <Svg height={190} width={190}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="featuredGlow" r="50%">
            <Stop offset="0" stopColor="rgb(99,102,241)" stopOpacity={0.4} />
            <Stop offset="0.7" stopColor="rgb(99,102,241)" stopOpacity={0} />
            <Stop offset="1" stopColor="rgb(99,102,241)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={95} cy={95} fill="url(#featuredGlow)" r={95} />
      </Svg>
    </Box>
  );
}

export function FeaturedEventCard({
  event,
  onOpen,
  onToggleJoin,
}: FeaturedEventCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Open event: ${event.title}`}
      accessibilityRole="button"
      className="mx-5 mt-1 overflow-hidden rounded-[24px] bg-primary p-[22px]"
      onPress={() => onOpen?.(event.id)}
    >
      <IndigoGlow />
      <VStack space="md">
        <HStack className="items-center" space="xs">
          <Badge variant="indigo">Featured</Badge>
          <Badge
            className="border-[rgba(250,250,250,0.25)]"
            textClassName="text-[rgba(250,250,250,0.85)]"
            variant="outline"
          >
            {event.tag}
          </Badge>
        </HStack>
        <VStack space="xs">
          <Text className="font-inter-bold text-[26px] leading-[30px] tracking-[-0.78px] text-primary-foreground">
            {event.title}
          </Text>
          <HStack className="items-center" space="sm">
            <HStack className="items-center" space="xs">
              <Icon color="rgba(250,250,250,0.6)" name="Clock" size={14} />
              <Text className="text-[rgba(250,250,250,0.75)]" size="xs">
                {formatDayLabel(event.dayLabel)} {event.dateLabel} · {event.timeLabel}
              </Text>
            </HStack>
            <HStack className="items-center" space="xs">
              <Icon color="rgba(250,250,250,0.6)" name="Globe" size={14} />
              <Text className="text-[rgba(250,250,250,0.75)]" size="xs">
                {event.place}
              </Text>
            </HStack>
          </HStack>
        </VStack>
        <HStack className="items-center" space="sm">
          <HStack>
            {event.attendees.map((attendee, index) => (
              <Box
                className={`rounded-full border-2 border-primary ${
                  index > 0 ? '-ml-[9px]' : ''
                }`}
                key={attendee.id}
              >
                <Avatar name={attendee.name} size="xs" src={attendee.avatarUrl ?? undefined} />
              </Box>
            ))}
          </HStack>
          <Text className="flex-1 text-[rgba(250,250,250,0.75)]" size="xs">
            {event.going} going
          </Text>
          <BookmarkButton
            activeColor="rgb(250,250,250)"
            inactiveColor="rgba(250,250,250,0.6)"
            targetId={event.id}
            targetType="event"
          />
          <Pressable
            accessibilityRole="button"
            className={`rounded-full px-5 py-2.5 ${
              event.joined
                ? 'bg-[rgba(250,250,250,0.14)]'
                : 'bg-primary-foreground'
            }`}
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              onToggleJoin(event.id);
            }}
          >
            <Text
              className={`font-inter-semibold text-[13px] leading-[16px] ${
                event.joined ? 'text-primary-foreground' : 'text-primary'
              }`}
            >
              {event.joined ? 'Going ✓' : 'Join event'}
            </Text>
          </Pressable>
        </HStack>
      </VStack>
    </Pressable>
  );
}

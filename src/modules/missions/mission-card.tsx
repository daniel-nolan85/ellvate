import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { EditedMark } from '@/src/components/shared/edited-mark';
import { Badge, type BadgeVariant } from '@/src/components/ui/badge';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { BookmarkButton } from '@/src/modules/bookmarks';

import { missionThemeIcon } from './mission-theme';
import { useAcceptMission, type Mission, type MissionStatus } from './use-missions';

const ACCENT = 'rgb(181,80,44)';
const AMBER = 'rgb(217,123,41)';
const WHITE = 'rgb(255,255,255)';

const STATUS_BADGE: Readonly<Record<
  MissionStatus,
  { readonly variant: BadgeVariant; readonly label: string }
>> = {
  active: { label: 'In progress', variant: 'accent' },
  done: { label: 'Complete', variant: 'success' },
};

interface MissionCardProps {
  readonly mission: Mission;
  readonly onOpen?: (missionId: string) => void;
  // Fires after a successful accept -- lets the screen follow the mission
  // across to the "In progress" filter instead of leaving the user staring
  // at the "Available" list while the card they just tapped vanishes from it.
  readonly onAccepted?: () => void;
}

export function MissionCard({ mission, onAccepted, onOpen }: MissionCardProps) {
  const acceptMission = useAcceptMission();

  const done = mission.status === 'done';
  const badge = STATUS_BADGE[mission.status];

  const handleAccept = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    void Haptics.selectionAsync().catch(() => undefined);
    acceptMission.mutate(mission.id, { onSuccess: () => onAccepted?.() });
  };

  // A mission can have multiple stops that may now be checked into in any
  // order (see MissionDetailScreen), so checking in directly from this card
  // no longer makes sense -- it always opens the detail screen instead,
  // same as tapping the rest of the card.
  const handleView = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onOpen?.(mission.id);
  };

  return (
    <Pressable
      accessibilityLabel={`Open mission: ${mission.title}`}
      accessibilityRole="button"
      className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-4 shadow-card"
      onPress={() => onOpen?.(mission.id)}
    >
      <HStack className="items-center gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-[14px] ${
            done ? 'bg-success' : 'bg-accent-subtle'
          }`}
        >
          <Icon
            color={done ? WHITE : ACCENT}
            name={done ? 'Check' : missionThemeIcon(mission.theme)}
            size={20}
          />
        </View>
        <VStack className="flex-1 gap-1">
          <HStack className="items-center gap-1">
            <Text className="font-inter-bold text-[15px] leading-[20px] tracking-[-0.15px] text-content">
              {mission.title}
            </Text>
            <EditedMark editedAt={mission.editedAt} />
          </HStack>
          <Text className="text-muted-foreground" size="xs">
            {mission.description}
          </Text>
          {mission.scheduledFor ? (
            <HStack className="items-center gap-1">
              <Icon color="rgb(120,108,94)" name="CalendarDays" size={12} />
              <Text className="text-muted-foreground" size="xs">
                {formatDateOnly(mission.scheduledFor)}
              </Text>
            </HStack>
          ) : null}
        </VStack>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <BookmarkButton targetId={mission.id} targetType='mission' />
      </HStack>
      <HStack className="items-center gap-2">
        <HStack className="flex-1 gap-1">
          {Array.from({ length: mission.stopsTotal }, (_, index) => (
            <View
              className={`h-[5px] flex-1 rounded-full ${
                index < mission.stopsDone
                  ? done ? 'bg-success' : 'bg-accent'
                  : 'bg-muted'
              }`}
              key={index}
            />
          ))}
        </HStack>
        <Text className="shrink-0 text-muted-foreground" size="xs">
          {mission.stopsDone}/{mission.stopsTotal} stops
        </Text>
        <Badge leftIcon={<Icon color={AMBER} name="Star" size={11} />} variant="amber">
          {mission.xp} XP
        </Badge>
      </HStack>
      {mission.status === 'active' && !mission.accepted ? (
        <Button
          className="self-start rounded-full bg-accent"
          isDisabled={acceptMission.isPending}
          onPress={handleAccept}
          size="sm"
        >
          <Icon color={WHITE} name="Favourite" size={15} />
          <ButtonText className="font-inter-semibold text-accent-foreground">
            Accept challenge
          </ButtonText>
        </Button>
      ) : null}
      {mission.status === 'active' && mission.accepted ? (
        <Button
          className="self-start rounded-full bg-accent"
          onPress={handleView}
          size="sm"
        >
          <Icon color={WHITE} name="Eye" size={15} />
          <ButtonText className="font-inter-semibold text-accent-foreground">
            View
          </ButtonText>
        </Button>
      ) : null}
    </Pressable>
  );
}

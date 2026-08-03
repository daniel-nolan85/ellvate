import { useState } from 'react';

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

import { useCheckIn, type Mission, type MissionStatus } from './use-missions';

const ACCENT = 'rgb(181,80,44)';
const AMBER = 'rgb(217,123,41)';
const WHITE = 'rgb(255,255,255)';

const STATUS_BADGE: Readonly<Record<
  MissionStatus,
  { readonly variant: BadgeVariant; readonly label: string }
>> = {
  active: { label: 'In progress', variant: 'accent' },
  done: { label: 'Complete', variant: 'success' },
  locked: { label: 'Locked', variant: 'muted' },
};

interface MissionCardProps {
  readonly mission: Mission;
  readonly onOpen?: (missionId: string) => void;
}

export function MissionCard({ mission, onOpen }: MissionCardProps) {
  const checkIn = useCheckIn();
  const [awardedXp, setAwardedXp] = useState<number | null>(null);

  const done = mission.status === 'done';
  const locked = mission.status === 'locked';
  const badge = STATUS_BADGE[mission.status];

  const handleCheckIn = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    void Haptics.selectionAsync().catch(() => undefined);
    checkIn.mutate(mission.id, {
      onSuccess: (result) => {
        if (result.awardedXp > 0) {
          setAwardedXp(result.awardedXp);
        }
      },
    });
  };

  return (
    <Pressable
      accessibilityLabel={`Open mission: ${mission.title}`}
      accessibilityRole="button"
      className={`gap-3 rounded-[20px] border border-surface-hairline bg-paper p-4 shadow-card ${
        locked ? 'opacity-[0.55]' : ''
      }`}
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
            name={locked ? 'Lock' : done ? 'Check' : mission.icon}
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
      {mission.status === 'active' && awardedXp === null ? (
        <Button
          className="self-start rounded-full bg-accent"
          isDisabled={checkIn.isPending}
          onPress={handleCheckIn}
          size="sm"
        >
          <Icon color={WHITE} name="CheckCircle" size={15} />
          <ButtonText className="font-inter-semibold text-accent-foreground">
            Check in
          </ButtonText>
        </Button>
      ) : null}
      {awardedXp !== null ? (
        <Text className="font-inter-bold text-success" size="xs">
          Nice — +{awardedXp} XP
        </Text>
      ) : null}
    </Pressable>
  );
}

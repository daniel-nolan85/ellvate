import { useState } from 'react';

import * as Haptics from 'expo-haptics';
import { View } from 'react-native';

import { Badge, type BadgeVariant } from '@/src/components/ui/badge';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { useCheckIn, type Mission, type MissionStatus } from './use-missions';

const INDIGO = 'rgb(99,102,241)';
const WHITE = 'rgb(255,255,255)';

const STATUS_BADGE: Readonly<Record<
  MissionStatus,
  { readonly variant: BadgeVariant; readonly label: string }
>> = {
  active: { label: 'In progress', variant: 'indigo' },
  done: { label: 'Complete', variant: 'success' },
  locked: { label: 'Locked', variant: 'muted' },
};

interface MissionCardProps {
  readonly mission: Mission;
}

export function MissionCard({ mission }: MissionCardProps) {
  const checkIn = useCheckIn();
  const [awardedXp, setAwardedXp] = useState<number | null>(null);

  const done = mission.status === 'done';
  const locked = mission.status === 'locked';
  const badge = STATUS_BADGE[mission.status];

  const handleCheckIn = () => {
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
    <View
      className={`gap-3 rounded-[20px] border border-line bg-canvas p-4 ${
        locked ? 'opacity-[0.55]' : ''
      }`}
    >
      <HStack className="items-center gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-[14px] ${
            done ? 'bg-success' : 'bg-indigo-subtle'
          }`}
        >
          <Icon
            color={done ? WHITE : INDIGO}
            name={locked ? 'Lock' : done ? 'Check' : mission.icon}
            size={20}
          />
        </View>
        <VStack className="flex-1 gap-1">
          <Text className="font-inter-bold text-[15px] leading-[20px] tracking-[-0.15px] text-content">
            {mission.title}
          </Text>
          <Text className="text-muted-foreground" size="xs">
            {mission.description}
          </Text>
        </VStack>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </HStack>
      <HStack className="items-center gap-2">
        <HStack className="flex-1 gap-1">
          {Array.from({ length: mission.stopsTotal }, (_, index) => (
            <View
              className={`h-[5px] flex-1 rounded-full ${
                index < mission.stopsDone
                  ? done ? 'bg-success' : 'bg-indigo'
                  : 'bg-muted'
              }`}
              key={index}
            />
          ))}
        </HStack>
        <Text className="shrink-0 text-muted-foreground" size="xs">
          {mission.stopsDone}/{mission.stopsTotal} stops
        </Text>
        <Badge leftIcon={<Icon name="Star" size={11} />} variant="outline">
          {mission.xp} XP
        </Badge>
      </HStack>
      {mission.status === 'active' && awardedXp === null ? (
        <Button
          className="self-start rounded-full bg-primary"
          isDisabled={checkIn.isPending}
          onPress={handleCheckIn}
          size="sm"
        >
          <Icon color="rgb(250,250,250)" name="CheckCircle" size={15} />
          <ButtonText className="font-inter-semibold text-primary-foreground">
            Check in
          </ButtonText>
        </Button>
      ) : null}
      {awardedXp !== null ? (
        <Text className="font-inter-bold text-success" size="xs">
          Nice — +{awardedXp} XP
        </Text>
      ) : null}
    </View>
  );
}

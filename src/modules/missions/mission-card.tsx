import { useState } from 'react';

import * as Haptics from 'expo-haptics';
import { Image, Pressable, View } from 'react-native';

import { EditedMark } from '@/src/components/shared/edited-mark';
import { Badge, type BadgeVariant } from '@/src/components/ui/badge';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { BookmarkButton } from '@/src/modules/bookmarks';
import { pickGalleryImages, type PickedImage } from '@/src/platform/media-picker';

import { missionThemeIcon } from './mission-theme';
import {
  useAcceptMission,
  useCheckIn,
  type Mission,
  type MissionStatus,
} from './use-missions';

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
  readonly onMissionComplete?: (awardedXp: number) => void;
}

export function MissionCard({ mission, onMissionComplete, onOpen }: MissionCardProps) {
  const acceptMission = useAcceptMission();
  const checkIn = useCheckIn(onMissionComplete);
  const [checkInPhoto, setCheckInPhoto] = useState<PickedImage | null>(null);

  const done = mission.status === 'done';
  const badge = STATUS_BADGE[mission.status];
  const isFinalStop = mission.stopsDone + 1 >= mission.stopsTotal;

  const handleAccept = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    void Haptics.selectionAsync().catch(() => undefined);
    acceptMission.mutate(mission.id);
  };

  const handleAttachPhoto = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    const [picked] = await pickGalleryImages({ selectionLimit: 1 });
    if (picked) {
      setCheckInPhoto(picked);
    }
  };

  const handleCheckIn = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (isFinalStop && !checkInPhoto) {
      // WHY: the completing check-in requires a photo — attach one right
      // here instead of sending a check-in the server would just reject.
      void handleAttachPhoto(event);
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    checkIn.mutate(
      {
        missionId: mission.id,
        photo: checkInPhoto
          ? {
              dataUrl: `data:${checkInPhoto.mimeType};base64,${checkInPhoto.base64}`,
              filename: checkInPhoto.filename,
            }
          : undefined,
      },
      { onSuccess: () => setCheckInPhoto(null) },
    );
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
        <VStack className="gap-2.5">
          {checkInPhoto ? (
            <HStack className="items-center gap-2.5">
              <Image
                source={{ uri: checkInPhoto.uri }}
                style={{ borderRadius: 8, height: 36, width: 36 }}
              />
              <Text className="flex-1 text-muted-foreground" size="xs">
                Photo attached
              </Text>
              <Pressable
                accessibilityLabel="Remove photo"
                accessibilityRole="button"
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation();
                  setCheckInPhoto(null);
                }}
              >
                <Icon color="rgb(120,108,94)" name="Close" size={16} />
              </Pressable>
            </HStack>
          ) : null}
          <Button
            className="self-start rounded-full bg-accent"
            isDisabled={checkIn.isPending}
            onPress={handleCheckIn}
            size="sm"
          >
            <Icon color={WHITE} name="CheckCircle" size={15} />
            <ButtonText className="font-inter-semibold text-accent-foreground">
              {isFinalStop
                ? checkInPhoto
                  ? 'Finish mission'
                  : 'Add photo to finish'
                : 'Check in'}
            </ButtonText>
          </Button>
        </VStack>
      ) : null}
    </Pressable>
  );
}

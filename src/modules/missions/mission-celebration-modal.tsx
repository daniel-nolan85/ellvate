import { Modal, Pressable, View } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

const WHITE = 'rgb(255,255,255)';
const AMBER = 'rgb(217,123,41)';

interface MissionCelebrationModalProps {
  readonly awardedXp: number | null;
  readonly onClose: () => void;
}

export function MissionCelebrationModal({
  awardedXp,
  onClose,
}: MissionCelebrationModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={awardedXp !== null}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.5)] px-8"
        onPress={onClose}
      >
        <Pressable
          className="w-full items-center gap-2.5 rounded-[24px] bg-paper p-7"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-success">
            <Icon color={WHITE} name="Check" size={30} />
          </View>
          <Text className="font-inter-bold text-[19px] text-content">
            Mission complete!
          </Text>
          <Text className="text-center text-text-muted" size="sm">
            Nice work — you earned
          </Text>
          <HStack className="items-center gap-1.5 rounded-full bg-amber-subtle px-4 py-2">
            <Icon color={AMBER} name="Star" size={15} />
            <Text className="font-inter-bold text-[15px] text-content">
              +{awardedXp} XP
            </Text>
          </HStack>
          <VStack className="w-full pt-2">
            <Button className="w-full rounded-full bg-accent" onPress={onClose} size="sm">
              <ButtonText className="font-inter-semibold text-accent-foreground">
                Nice!
              </ButtonText>
            </Button>
          </VStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

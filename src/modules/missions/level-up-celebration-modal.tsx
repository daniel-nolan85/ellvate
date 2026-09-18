import { Modal, Pressable, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

const WHITE = 'rgb(255,255,255)';

interface LevelUpCelebrationModalProps {
  readonly newLevel: number | null;
  // The rank the level currently sits in (unchanged by this level-up --
  // when it DOES change, RankUpCelebrationModal fires instead of this one).
  // Shown so a level-up always reminds the user where they stand, not just
  // the bare number.
  readonly title: string;
  readonly onClose: () => void;
}

// Deliberately bigger/rarer than MissionCelebrationModal's routine XP toast
// -- a level-up doesn't happen on every check-in, so it gets its own beat
// (amber badge instead of the plain success check, an entrance animation)
// rather than reusing the same shell with a different label. Still smaller
// than RankUpCelebrationModal -- most level-ups stay within the same rank
// tier, so that bigger moment is reserved for when the rank itself changes.
export function LevelUpCelebrationModal({
  newLevel,
  title,
  onClose,
}: LevelUpCelebrationModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={newLevel !== null}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.5)] px-8"
        onPress={onClose}
      >
        <Pressable
          className="w-full items-center gap-2.5 rounded-[24px] bg-paper p-7"
          onPress={(event) => event.stopPropagation()}
        >
          <Animated.View entering={ZoomIn.duration(350)}>
            <View className="h-20 w-20 items-center justify-center rounded-full bg-amber-subtle">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-amber">
                <Icon color={WHITE} name="Star" size={32} />
              </View>
            </View>
          </Animated.View>
          <Text className="font-inter-bold text-[11px] tracking-[1.5px] text-accent">
            LEVEL UP
          </Text>
          <Text className="font-inter-bold text-[24px] text-content">
            You reached Level {newLevel}
          </Text>
          {title ? (
            <Text className="font-inter-semibold text-[13px] text-text-muted">
              {title}
            </Text>
          ) : null}
          <Text className="text-center text-text-muted" size="sm">
            Keep completing missions to climb the leaderboard.
          </Text>
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

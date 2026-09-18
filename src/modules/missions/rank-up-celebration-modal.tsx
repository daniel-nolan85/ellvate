import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

const WHITE = 'rgb(255,255,255)';

interface RankUpCelebrationModalProps {
  readonly newTitle: string | null;
  readonly onClose: () => void;
}

function RankGlow() {
  return (
    <View className="absolute inset-x-0 -top-[100px] items-center" pointerEvents="none">
      <Svg height={280} width={280}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="rankUpGlow" r="50%">
            <Stop offset="0%" stopColor="rgb(181,80,44)" stopOpacity={0.5} />
            <Stop offset="70%" stopColor="rgb(181,80,44)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={140} cy={140} fill="url(#rankUpGlow)" r={140} />
      </Svg>
    </View>
  );
}

// The biggest of the three check-in celebrations (the routine XP toast <
// LevelUpCelebrationModal < this) -- fires only when a level-up also
// crosses into a new rank tier (see computeRankedUpTo), which happens far
// less often than a plain level-up, so it earns a distinctly bigger
// moment: a dark hero-style panel (the same treatment XpHero itself uses)
// with a glow, a bigger badge, and the new rank name as the headline
// instead of a level number.
export function RankUpCelebrationModal({
  newTitle,
  onClose,
}: RankUpCelebrationModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={newTitle !== null}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.6)] px-8"
        onPress={onClose}
      >
        <Pressable
          className="relative w-full items-center gap-2.5 overflow-hidden rounded-[28px] bg-primary p-8"
          onPress={(event) => event.stopPropagation()}
        >
          <RankGlow />
          <Animated.View entering={ZoomIn.duration(400)}>
            <View className="h-24 w-24 items-center justify-center rounded-full bg-[rgba(250,250,250,0.15)]">
              <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-amber">
                <Icon color={WHITE} name="Trophy" size={36} />
              </View>
            </View>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(150).duration(300)}>
            <Text className="font-inter-bold text-[11px] tracking-[2px] text-[rgba(250,250,250,0.6)]">
              RANK UP
            </Text>
          </Animated.View>
          <Text className="text-center font-inter-bold text-[28px] text-primary-foreground">
            {newTitle}
          </Text>
          <Text className="text-center text-[rgba(250,250,250,0.7)]" size="sm">
            You&apos;ve earned a new rank in the community. Keep it up!
          </Text>
          <VStack className="w-full pt-2">
            <Button className="w-full rounded-full bg-accent" onPress={onClose} size="sm">
              <ButtonText className="font-inter-semibold text-accent-foreground">
                Amazing!
              </ButtonText>
            </Button>
          </VStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

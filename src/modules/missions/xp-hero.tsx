import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { HStack } from '@/src/components/ui/hstack';
import { ProgressRing } from '@/src/components/ui/progress-ring';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import type { UserProgress } from './use-missions';

interface XpHeroProps {
  readonly progress: UserProgress;
}

function HeroGlow() {
  return (
    <View
      className="absolute -bottom-[80px] -left-[60px] h-[220px] w-[220px]"
      pointerEvents="none"
    >
      <Svg height={220} width={220}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="xpHeroGlow" r="50%">
            <Stop offset="0%" stopColor="rgb(181,80,44)" stopOpacity={0.35} />
            <Stop offset="70%" stopColor="rgb(181,80,44)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={110} cy={110} fill="url(#xpHeroGlow)" r={110} />
      </Svg>
    </View>
  );
}

export function XpHero({ progress }: XpHeroProps) {
  const ringProgress = progress.xpForNextLevel > 0
    ? progress.xpIntoLevel / progress.xpForNextLevel
    : 0;

  return (
    <View className="relative mx-5 overflow-hidden rounded-[24px] bg-primary p-5">
      <HeroGlow />
      <HStack className="relative items-center gap-4">
        <ProgressRing progress={ringProgress} size={74} strokeWidth={6}>
          <Text className="font-inter-bold text-[20px] leading-[22px] text-primary-foreground">
            {progress.level}
          </Text>
          <Text className="font-inter-semibold text-[8px] tracking-[1px] text-[rgba(250,250,250,0.55)]">
            LEVEL
          </Text>
        </ProgressRing>
        <VStack className="flex-1 gap-1">
          <Text className="font-inter-semibold text-[10px] tracking-[0.8px] text-[rgba(250,250,250,0.6)]">
            {progress.title}
          </Text>
          <Text className="font-inter-bold text-[30px] leading-[32px] tracking-[-0.9px] text-primary-foreground">
            {progress.xp.toLocaleString()}
            <Text className="font-inter-semibold text-[15px] text-[rgba(250,250,250,0.55)]">
              {' '}XP
            </Text>
          </Text>
          <Text className="text-[rgba(250,250,250,0.7)]" size="xs">
            {progress.xpToNextLevel} XP to Level {progress.level + 1}
          </Text>
        </VStack>
      </HStack>
    </View>
  );
}

import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { HStack } from '@/src/components/ui/hstack';
import { ProgressRing } from '@/src/components/ui/progress-ring';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

// Moved here from the missions module -- this is now shown on Profile (the
// signed-in user's own) and MemberProfileScreen (someone else's) instead of
// on the Missions screen itself, which didn't need its own copy of the same
// level/XP summary already available one tab away. No self-margin (unlike
// its missions-screen original): both callers already control their own
// horizontal inset, one via a wrapping Pressable's className, the other via
// its own px-5 container.
interface XpHeroProps {
  readonly level: number;
  readonly title: string;
  readonly xp: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
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

export function XpHero({
  level,
  title,
  xp,
  xpForNextLevel,
  xpIntoLevel,
  xpToNextLevel,
}: XpHeroProps) {
  const ringProgress = xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 0;

  return (
    <View className="relative overflow-hidden rounded-[24px] bg-primary p-5">
      <HeroGlow />
      <HStack className="relative items-center gap-4">
        <ProgressRing progress={ringProgress} size={74} strokeWidth={6}>
          <Text className="font-inter-bold text-[20px] leading-[22px] text-primary-foreground">
            {level}
          </Text>
          <Text className="font-inter-semibold text-[8px] tracking-[1px] text-[rgba(250,250,250,0.55)]">
            LEVEL
          </Text>
        </ProgressRing>
        <VStack className="flex-1 gap-1">
          <Text className="font-inter-semibold text-[10px] tracking-[0.8px] text-[rgba(250,250,250,0.6)]">
            {title}
          </Text>
          <Text className="font-inter-bold text-[30px] leading-[32px] tracking-[-0.9px] text-primary-foreground">
            {xp.toLocaleString()}
            <Text className="font-inter-semibold text-[15px] text-[rgba(250,250,250,0.55)]">
              {' '}XP
            </Text>
          </Text>
          <Text className="text-[rgba(250,250,250,0.7)]" size="xs">
            {xpToNextLevel} XP to Level {level + 1}
          </Text>
        </VStack>
      </HStack>
    </View>
  );
}

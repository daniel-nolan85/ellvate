import { View } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Avatar } from '@/src/components/ui/avatar';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';

const HERO_AVATARS = ['ML', 'AK', 'JD', 'PR'] as const;

interface GlowCircleProps {
  readonly id: string;
  readonly size: number;
  readonly opacity: number;
  readonly fade: number;
  readonly className: string;
}

function GlowCircle({ id, size, opacity, fade, className }: GlowCircleProps) {
  return (
    <View className={className} pointerEvents="none">
      <Svg height={size} width={size}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={id} r="50%">
            <Stop offset={0} stopColor="rgb(99,102,241)" stopOpacity={opacity} />
            <Stop offset={fade} stopColor="rgb(99,102,241)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} fill={`url(#${id})`} r={size / 2} />
      </Svg>
    </View>
  );
}

interface WelcomeStepProps {
  readonly onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <View className="flex-1 overflow-hidden bg-primary">
      <StatusBar style="light" />
      <GlowCircle
        className="absolute -right-20 -top-[60px]"
        fade={0.68}
        id="welcome-glow-top"
        opacity={0.45}
        size={320}
      />
      <GlowCircle
        className="absolute -left-[100px] bottom-[120px]"
        fade={0.7}
        id="welcome-glow-bottom"
        opacity={0.22}
        size={300}
      />
      <View className="flex-1 justify-end px-[26px] pb-2">
        <Text className="font-inter-bold text-[11px] tracking-[2px] text-indigo">
          LAKE LAS VEGAS
        </Text>
        <Text className="mt-2.5 font-inter-bold text-[44px] leading-[46px] tracking-[-0.035em] text-primary-foreground">
          {'Your lakeside neighbourhood,\nin your pocket.'}
        </Text>
        <Text className="mt-3.5 leading-6 text-[rgba(250,250,250,0.65)]" size="md">
          Forum, events, and real-world missions — everything happening around the lake, with the
          people who live here.
        </Text>
        <HStack className="mt-[18px] items-center" space="sm">
          <HStack>
            {HERO_AVATARS.map((initials, index) => (
              <View
                className={`rounded-full border-2 border-primary ${index > 0 ? '-ml-[9px]' : ''}`}
                key={initials}
              >
                <Avatar name={initials.split('').join(' ')} size="xs" />
              </View>
            ))}
          </HStack>
          <Text className="text-[rgba(250,250,250,0.6)]" size="xs">
            2,400+ neighbours already here
          </Text>
        </HStack>
      </View>
      <View className="px-5 pb-[34px] pt-3.5">
        <Button
          className="h-[52px] w-full rounded-full bg-primary-foreground data-[hover=true]:bg-primary-foreground data-[active=true]:bg-primary-foreground"
          onPress={onNext}
          size="lg"
        >
          <ButtonText className="font-inter-semibold text-[15px] text-primary data-[hover=true]:text-primary data-[active=true]:text-primary">
            Get started
          </ButtonText>
        </Button>
      </View>
    </View>
  );
}

import React, { useCallback, useEffect, useState } from 'react';

import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Icon } from '@/src/components/ui/icon';
import { ProgressRing } from '@/src/components/ui/progress-ring';
import { Text } from '@/src/components/ui/text';

const ACCENT = 'rgb(181,80,44)';
const WHITE = 'rgb(255,255,255)';
const HOLD_DURATION_MS = 750;
const CELEBRATION_MS = 1400;

function GlowBackdrop() {
  return (
    <View
      className="absolute h-[300px] w-[300px]"
      style={{ left: -80, top: -60 }}
    >
      <Svg height={300} viewBox="0 0 300 300" width={300}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="commit-glow" r="50%">
            <Stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <Stop offset="70%" stopColor={ACCENT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={150} cy={150} fill="url(#commit-glow)" r={150} />
      </Svg>
    </View>
  );
}

function Celebration() {
  return (
    <Animated.View className="items-center gap-3.5" entering={ZoomIn.duration(300)}>
      <View className="h-[136px] w-[136px] items-center justify-center rounded-full bg-[rgba(34,197,94,0.06)]">
        <View className="h-[108px] w-[108px] items-center justify-center rounded-full bg-[rgba(34,197,94,0.15)]">
          <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-success">
            <Icon color={WHITE} name="Check" size={40} />
          </View>
        </View>
      </View>
      <Text className="font-inter-bold text-[28px] tracking-[-0.84px] text-primary-foreground">
        You&apos;re in.
      </Text>
      <View className="flex-row items-center gap-2 rounded-full bg-[rgba(250,250,250,0.1)] px-[18px] py-[9px]">
        <Icon color={ACCENT} name="Star" size={14} />
        <Text className="font-inter-semibold text-[13px] text-primary-foreground">
          +50 XP · First mission complete
        </Text>
      </View>
      <Text className="text-[rgba(250,250,250,0.6)]" size="sm">
        Joining the community
      </Text>
    </Animated.View>
  );
}

interface CommitStepProps {
  readonly error?: string | null;
  readonly onDone: () => void;
  readonly onRetry?: () => void;
}

export function CommitStep({ error, onDone, onRetry }: CommitStepProps) {
  const holdProgress = useSharedValue(0);
  const [ringProgress, setRingProgress] = useState(0);
  const [complete, setComplete] = useState(false);

  useAnimatedReaction(
    () => holdProgress.value,
    (value) => {
      runOnJS(setRingProgress)(value);
    },
  );

  const handleHoldComplete = useCallback(() => {
    setComplete(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handlePressIn = useCallback(() => {
    if (complete) {
      return;
    }
    holdProgress.value = withTiming(
      1,
      { duration: HOLD_DURATION_MS, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(handleHoldComplete)();
        }
      },
    );
  }, [complete, handleHoldComplete, holdProgress]);

  const handlePressOut = useCallback(() => {
    if (holdProgress.value < 1) {
      cancelAnimation(holdProgress);
      holdProgress.value = 0;
    }
  }, [holdProgress]);

  useEffect(() => {
    if (!complete) {
      return;
    }
    const timer = setTimeout(onDone, CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [complete, onDone]);

  const holding = ringProgress > 0;

  return (
    <View className="flex-1 overflow-hidden bg-primary">
      <StatusBar style="light" />
      <GlowBackdrop />
      <View className="flex-1 items-center justify-center gap-7 px-[30px]">
        {error ? (
          <View className="items-center gap-5">
            <Text className="text-center font-inter-bold text-[28px] text-primary-foreground">
              Could not finish setup
            </Text>
            <Text className="text-center text-[rgba(250,250,250,0.7)]" size="md">
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="rounded-full bg-primary-foreground px-6 py-3"
              onPress={onRetry}
              testID="onboarding-completion-retry"
            >
              <Text className="font-inter-semibold text-primary">Try again</Text>
            </Pressable>
          </View>
        ) : complete ? (
          <Celebration />
        ) : (
          <>
            <View className="items-center">
              <Text className="text-center font-inter-bold text-[11px] tracking-[2px] text-accent">
                ONE LAST THING
              </Text>
              <Text className="mt-2.5 text-center font-inter-bold text-[30px] leading-[34px] tracking-[-0.9px] text-primary-foreground">
                Set your first goal
              </Text>
              <Text
                className="mt-2.5 text-center text-[rgba(250,250,250,0.65)]"
                size="md"
              >
                Attend one event this month. Hold the circle to commit.
              </Text>
            </View>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              testID="onboarding-commit-hold"
            >
              <View className="absolute inset-[4px] rounded-full bg-[rgba(250,250,250,0.06)]" />
              <ProgressRing
                color={ACCENT}
                progress={ringProgress}
                size={132}
                strokeWidth={6}
                trackColor="rgba(250,250,250,0.15)"
              >
                <View className="items-center gap-1">
                  <Icon
                    color={holding ? ACCENT : 'rgba(250,250,250,0.7)'}
                    fill={holding ? ACCENT : 'none'}
                    name="Favourite"
                    size={26}
                  />
                  <Text className="font-inter-semibold text-[11px] tracking-[0.8px] text-[rgba(250,250,250,0.55)]">
                    HOLD
                  </Text>
                </View>
              </ProgressRing>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

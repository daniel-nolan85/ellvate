import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AiMark } from '@/src/components/ui/ai-mark';
import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';

const ACCENT = 'rgb(181,80,44)';
const RIPPLE_DURATION = 1400;

// A soft expanding-and-fading ring behind the AiMark glyph, in place of the
// raw tool()-style label previously shown while a request was in flight.
// One shared progress value (0..1, reset each loop via withRepeat) drives
// both the ring's scale and its fade, so the ripple reads as a single
// continuous pulse rather than a bounce.
export function ThinkingIndicator() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: RIPPLE_DURATION, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.4, 0.18, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 2.1]) }],
  }));

  return (
    <HStack className="items-center gap-2 self-start" testID="assistant-thinking">
      <View className="h-7 w-7 items-center justify-center">
        <Animated.View
          className="absolute h-7 w-7 rounded-full bg-accent"
          style={rippleStyle}
        />
        <AiMark color={ACCENT} size={16} />
      </View>
      <Text className="text-[13px] text-text-muted">Thinking…</Text>
    </HStack>
  );
}

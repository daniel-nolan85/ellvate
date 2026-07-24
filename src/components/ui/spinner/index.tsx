import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const DEFAULT_COLOR = 'rgb(110,127,74)';

const SIZE_PX: Readonly<Record<'small' | 'large', number>> = {
  large: 36,
  small: 20,
};

interface SpinnerProps {
  readonly size?: 'small' | 'large';
  readonly color?: string;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

// A little desert saguaro that sways side to side in a loop — the app's
// custom stand-in for a generic loading spinner. The trunk and each arm are
// built from two overlapping rounded rects (a vertical piece + a stub that
// joins it to the trunk) so the silhouette reads as a continuous rounded
// "hook" rather than a boxy L-shape.
function CactusGlyph({ color }: { readonly color: string }) {
  return (
    <Svg height="100%" viewBox="0 0 24 24" width="100%">
      <Rect fill={color} height={8} rx={1.7} width={3.4} x={3.5} y={6} />
      <Rect fill={color} height={3.4} rx={1.7} width={6.3} x={3.5} y={11.5} />
      <Rect fill={color} height={8} rx={1.7} width={3.4} x={17.1} y={2} />
      <Rect fill={color} height={3.4} rx={1.7} width={6.3} x={14.2} y={7.3} />
      <Rect fill={color} height={17} rx={2.7} width={5.4} x={9.3} y={5} />
    </Svg>
  );
}

// Custom loading indicator: a cactus that sways gently, replacing the
// platform ActivityIndicator everywhere in the app. Keeps the same
// size/color/aria-label surface the old ActivityIndicator-backed Spinner
// had, so every existing call site works unchanged.
function Spinner({
  'aria-label': ariaLabel = 'loading',
  color = DEFAULT_COLOR,
  size,
}: SpinnerProps) {
  const px = size ? SIZE_PX[size] : 24;
  const sway = useSharedValue(-1);

  useEffect(() => {
    sway.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [sway]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value * 8}deg` }],
  }));

  return (
    <View accessibilityLabel={ariaLabel} style={{ height: px, width: px }}>
      <Animated.View style={[{ height: '100%', width: '100%' }, animatedStyle]}>
        <CactusGlyph color={color} />
      </Animated.View>
    </View>
  );
}

Spinner.displayName = 'Spinner';

export { Spinner };

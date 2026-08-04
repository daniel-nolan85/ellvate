import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const DEFAULT_COLOR = 'rgb(110,127,74)';
const SPIKE_COLOR = 'rgb(201,138,58)';
const SHADE_COLOR = 'rgb(36,38,26)';
const SHINE_COLOR = 'rgb(244,239,224)';
const MOUTH_COLOR = 'rgb(58,50,34)';
const SHADOW_COLOR = 'rgb(60,52,33)';

const SIZE_PX: Readonly<Record<'small' | 'large' | 'xlarge', number>> = {
  large: 36,
  small: 20,
  xlarge: 96,
};

interface SpinnerProps {
  readonly size?: 'small' | 'large' | 'xlarge';
  readonly color?: string;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

// A little desert saguaro wearing sunglasses that does a bouncy two-step —
// the app's custom stand-in for a generic loading spinner. One shared
// progress value (-1..1, yoyo'd via withRepeat) drives the body bounce, both
// arms' kicks, and the ground shadow's squash together, so every part stays
// in sync from a single animation loop instead of four independent ones.
function CactusGlyph({
  color,
  progress,
}: {
  readonly color: string;
  readonly progress: SharedValue<number>;
}) {
  const shadowProps = useAnimatedProps(() => ({
    transform: `translate(12 23) scale(${interpolate(progress.value, [-1, 1], [1, 0.85])} 1) translate(-12 -23)`,
  }));
  const bodyProps = useAnimatedProps(() => ({
    transform: `translate(0 ${interpolate(progress.value, [-1, 1], [0, -1.5])}) rotate(${interpolate(progress.value, [-1, 1], [-7, 7])} 12 24)`,
  }));
  const armLProps = useAnimatedProps(() => ({
    transform: `rotate(${interpolate(progress.value, [-1, 1], [12, -16])} 9.3 13.2)`,
  }));
  const armRProps = useAnimatedProps(() => ({
    transform: `rotate(${interpolate(progress.value, [-1, 1], [-12, 16])} 14.7 9)`,
  }));

  return (
    <Svg height="100%" viewBox="0 0 24 24" width="100%">
      <AnimatedEllipse
        animatedProps={shadowProps}
        cx={12}
        cy={23}
        fill={SHADOW_COLOR}
        opacity={0.12}
        rx={7}
        ry={1.4}
      />
      <AnimatedG animatedProps={bodyProps}>
        <AnimatedG animatedProps={armLProps}>
          <Rect fill={color} height={8} rx={1.7} width={3.4} x={3.5} y={6} />
          <Rect fill={color} height={3.4} rx={1.7} width={6.3} x={3.5} y={11.5} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={3.6} x2={2.7} y1={7.5} y2={7.1} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={3.6} x2={2.7} y1={10.5} y2={10.1} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={3.6} x2={2.7} y1={13} y2={12.6} />
        </AnimatedG>
        <AnimatedG animatedProps={armRProps}>
          <Rect fill={color} height={8} rx={1.7} width={3.4} x={17.1} y={2} />
          <Rect fill={color} height={3.4} rx={1.7} width={6.3} x={14.2} y={7.3} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={20.4} x2={21.3} y1={3.5} y2={3.1} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={20.4} x2={21.3} y1={6} y2={5.6} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={20.4} x2={21.3} y1={8.5} y2={8.1} />
        </AnimatedG>

        <Rect fill={color} height={17} rx={2.7} width={5.4} x={9.3} y={5} />

        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={9.5} x2={8.6} y1={13} y2={13.5} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={9.5} x2={8.6} y1={16} y2={16.5} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={9.5} x2={8.6} y1={19} y2={19.5} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={14.5} x2={15.4} y1={14.5} y2={15} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={14.5} x2={15.4} y1={17.5} y2={18} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={14.5} x2={15.4} y1={20.5} y2={21} />

        <Rect fill={SHADE_COLOR} height={0.4} rx={0.2} width={0.6} x={9.3} y={8.2} />
        <Rect fill={SHADE_COLOR} height={0.4} rx={0.2} width={0.6} x={14.15} y={8.2} />
        <Rect fill={SHADE_COLOR} height={0.55} rx={0.25} width={0.9} x={11.55} y={8} />
        <Circle cx={10.9} cy={8.4} fill={SHADE_COLOR} r={1.05} />
        <Circle cx={13.1} cy={8.4} fill={SHADE_COLOR} r={1.05} />
        <Ellipse cx={10.55} cy={8.05} fill={SHINE_COLOR} opacity={0.85} rx={0.32} ry={0.2} />
        <Ellipse cx={12.75} cy={8.05} fill={SHINE_COLOR} opacity={0.85} rx={0.32} ry={0.2} />
        <Path d="M 10.6 10.3 Q 12 11.3 13.4 10.3" fill="none" stroke={MOUTH_COLOR} strokeLinecap="round" strokeWidth={0.55} />
      </AnimatedG>
    </Svg>
  );
}

// Custom loading indicator: a dancing cactus that replaces the platform
// ActivityIndicator everywhere in the app. Keeps the same size/color/
// aria-label surface the old ActivityIndicator-backed Spinner had, so every
// existing call site works unchanged.
function Spinner({
  'aria-label': ariaLabel = 'loading',
  color = DEFAULT_COLOR,
  size,
}: SpinnerProps) {
  const px = size ? SIZE_PX[size] : 24;
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 450, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [progress]);

  return (
    <View accessibilityLabel={ariaLabel} style={{ height: px, width: px }}>
      <CactusGlyph color={color} progress={progress} />
    </View>
  );
}

Spinner.displayName = 'Spinner';

export { Spinner };

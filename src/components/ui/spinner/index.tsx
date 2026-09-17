import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const DEFAULT_COLOR = 'rgb(110,127,74)';
const SPIKE_COLOR = 'rgb(201,138,58)';
const SHADE_COLOR = 'rgb(36,38,26)';
const SHINE_COLOR = 'rgb(244,239,224)';
const MOUTH_COLOR = 'rgb(58,50,34)';
const SHADOW_COLOR = 'rgb(60,52,33)';
const CROWN_COLOR = 'rgb(230,185,60)';

// Mixes an 'rgb(r,g,b)' string toward white (percent > 0) or black
// (percent < 0), so the body/lens gradients below track whatever `color` a
// caller passes instead of only looking right with the default green.
const shade = (value: string, percent: number): string => {
  const match = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(value);
  if (!match) {
    return value;
  }
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const mix = (channel: number) =>
    Math.round(percent >= 0 ? channel + (255 - channel) * percent : channel * (1 + percent));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
};

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
  // Scoped per instance (react-native-svg renders real <svg> ids on web) so
  // two Spinners on screen at once -- e.g. the boot splash's enlarged one
  // plus an ordinary loading spinner elsewhere -- never collide.
  // React's useId() includes colons, which are awkward inside an SVG
  // url(#id) reference on some renderers -- stripped for safety.
  const uid = useId().replace(/:/g, '');
  const bodyGradientId = `${uid}-body`;
  const lensGradientId = `${uid}-lens`;
  const crownGradientId = `${uid}-crown`;

  // Each animatedProps below returns `transform` as an array of single-
  // property objects (the same shape React Native's own View transform
  // takes) instead of one SVG transform-attribute string. Both spellings
  // describe the same matrix and render identically on a static frame, but
  // only the array form is wired to actually reach the native SVG view on
  // every animated frame under Fabric -- a worklet mutating a string-typed
  // `transform` prop was silently not propagating, which is why the cactus
  // never visibly moved despite the animation itself provably running (this
  // codebase's other animations, like Sheet's slide, use useAnimatedStyle on
  // a plain View and always animated fine -- only this SVG-specific path was
  // broken). A `rotate(deg cx cy)` pivot is expressed the same way SVG
  // itself expands it: translate to the pivot, rotate, translate back --
  // token-for-token the same order as the original SVG strings, since both
  // SVG and CSS/RN transforms apply right-to-left to the point.
  const shadowProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 12 },
      { translateY: 23 },
      { scaleX: interpolate(progress.value, [-1, 1], [1, 0.85]) },
      { translateX: -12 },
      { translateY: -23 },
    ],
  }));
  const bodyProps = useAnimatedProps(() => ({
    transform: [
      { translateY: interpolate(progress.value, [-1, 1], [0, -1.5]) },
      { translateX: 12 },
      { translateY: 24 },
      { rotate: `${interpolate(progress.value, [-1, 1], [-7, 7])}deg` },
      { translateX: -12 },
      { translateY: -24 },
    ],
  }));
  const armLProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 9.3 },
      { translateY: 13.2 },
      { rotate: `${interpolate(progress.value, [-1, 1], [12, -16])}deg` },
      { translateX: -9.3 },
      { translateY: -13.2 },
    ],
  }));
  const armRProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 14.7 },
      { translateY: 9 },
      { rotate: `${interpolate(progress.value, [-1, 1], [-12, 16])}deg` },
      { translateX: -14.7 },
      { translateY: -9 },
    ],
  }));

  const bodyStroke = shade(color, -0.35);
  const crownStroke = shade(CROWN_COLOR, -0.4);

  return (
    <Svg height="100%" viewBox="0 0 24 24" width="100%">
      <Defs>
        <LinearGradient id={bodyGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={shade(color, 0.32)} />
          <Stop offset="45%" stopColor={color} />
          <Stop offset="100%" stopColor={shade(color, -0.22)} />
        </LinearGradient>
        <LinearGradient id={lensGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={shade(SHADE_COLOR, 0.55)} />
          <Stop offset="100%" stopColor={shade(SHADE_COLOR, -0.3)} />
        </LinearGradient>
        <LinearGradient id={crownGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={shade(CROWN_COLOR, 0.35)} />
          <Stop offset="45%" stopColor={CROWN_COLOR} />
          <Stop offset="100%" stopColor={shade(CROWN_COLOR, -0.25)} />
        </LinearGradient>
      </Defs>
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
          <Rect fill={`url(#${bodyGradientId})`} height={8} rx={1.7} stroke={bodyStroke} strokeWidth={0.25} width={3.4} x={3.5} y={6} />
          <Rect fill={`url(#${bodyGradientId})`} height={3.4} rx={1.7} stroke={bodyStroke} strokeWidth={0.25} width={6.3} x={3.5} y={11.5} />
          <Rect fill={SHINE_COLOR} height={6.4} opacity={0.22} rx={0.4} width={0.8} x={4.1} y={6.8} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={3.6} x2={2.7} y1={7.5} y2={7.1} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={3.6} x2={2.7} y1={10.5} y2={10.1} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={3.6} x2={2.7} y1={13} y2={12.6} />
        </AnimatedG>
        <AnimatedG animatedProps={armRProps}>
          <Rect fill={`url(#${bodyGradientId})`} height={8} rx={1.7} stroke={bodyStroke} strokeWidth={0.25} width={3.4} x={17.1} y={2} />
          <Rect fill={`url(#${bodyGradientId})`} height={3.4} rx={1.7} stroke={bodyStroke} strokeWidth={0.25} width={6.3} x={14.2} y={7.3} />
          <Rect fill={SHINE_COLOR} height={6.4} opacity={0.22} rx={0.4} width={0.8} x={17.7} y={2.8} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={20.4} x2={21.3} y1={3.5} y2={3.1} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={20.4} x2={21.3} y1={6} y2={5.6} />
          <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={20.4} x2={21.3} y1={8.5} y2={8.1} />
        </AnimatedG>

        <Rect fill={`url(#${bodyGradientId})`} height={17} rx={2.7} stroke={bodyStroke} strokeWidth={0.25} width={5.4} x={9.3} y={5} />
        <Rect fill={SHINE_COLOR} height={14.5} opacity={0.2} rx={0.5} width={1} x={10} y={6} />

        <Rect fill={`url(#${crownGradientId})`} height={1.1} rx={0.4} stroke={crownStroke} strokeWidth={0.25} width={5.4} x={9.3} y={4.3} />
        <Path
          d="M 9.3 4.3 L 9.7 2.7 L 10.7 3.8 L 12 2.1 L 13.3 3.8 L 14.3 2.7 L 14.7 4.3 Z"
          fill={`url(#${crownGradientId})`}
          stroke={crownStroke}
          strokeLinejoin="round"
          strokeWidth={0.25}
        />
        <Rect fill={SHINE_COLOR} height={0.9} opacity={0.28} rx={0.2} width={0.6} x={9.75} y={4.35} />
        <Ellipse cx={12} cy={2.35} fill={SHINE_COLOR} opacity={0.85} rx={0.28} ry={0.18} />

        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={9.5} x2={8.6} y1={13} y2={13.5} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={9.5} x2={8.6} y1={16} y2={16.5} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={9.5} x2={8.6} y1={19} y2={19.5} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={14.5} x2={15.4} y1={14.5} y2={15} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={14.5} x2={15.4} y1={17.5} y2={18} />
        <Line stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35} x1={14.5} x2={15.4} y1={20.5} y2={21} />

        <Rect fill={SHADE_COLOR} height={0.4} rx={0.2} width={0.6} x={9.3} y={8.2} />
        <Rect fill={SHADE_COLOR} height={0.4} rx={0.2} width={0.6} x={14.15} y={8.2} />
        <Rect fill={SHADE_COLOR} height={0.55} rx={0.25} width={0.9} x={11.55} y={8} />
        <Circle cx={10.9} cy={8.4} fill={`url(#${lensGradientId})`} r={1.05} />
        <Circle cx={13.1} cy={8.4} fill={`url(#${lensGradientId})`} r={1.05} />
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
    // Reanimated's default reduceMotion is ReduceMotion.System, which jumps
    // straight to the end value (and freezes) when the OS/browser has
    // reduced-motion enabled. That reads as "broken" for a loading indicator
    // -- the motion here IS the content, not decoration -- so it opts out.
    progress.value = withRepeat(
      withTiming(1, {
        duration: 450,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [progress]);

  return (
    <View accessibilityLabel={ariaLabel} style={{ height: px, width: px }}>
      <CactusGlyph color={color} progress={progress} />
    </View>
  );
}

Spinner.displayName = 'Spinner';

interface CactusMascotProps {
  readonly size?: number;
  readonly color?: string;
  // false (the default): a single resting frame -- for empty states and
  // other non-loading moments, where a *dancing* cactus would wrongly read
  // as "still loading" instead of "genuinely nothing here." true: the same
  // loop Spinner itself uses, for a celebratory moment where motion is
  // actually wanted (e.g. a "you're all caught up" flourish).
  readonly animated?: boolean;
}

// The same hand-drawn cactus glyph Spinner dances everywhere the app is
// loading something, reused here as a static (by default) brand mascot for
// empty states and celebratory moments -- rather than a second illustration,
// which would read as a different character instead of the same one just
// standing still.
function CactusMascot({ animated = false, color = DEFAULT_COLOR, size = 96 }: CactusMascotProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animated) {
      return;
    }
    progress.value = withRepeat(
      withTiming(1, {
        duration: 450,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [animated, progress]);

  return (
    <View style={{ height: size, width: size }}>
      <CactusGlyph color={color} progress={progress} />
    </View>
  );
}

CactusMascot.displayName = 'CactusMascot';

export { CactusMascot, Spinner };

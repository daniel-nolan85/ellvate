import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface GlowBackdropProps {
  readonly color?: string;
  readonly size?: number;
  readonly opacity?: number;
  readonly left?: number;
  readonly top?: number;
}

// A soft radial glow anchored behind a header or hero moment -- desert-warm
// light rather than a flat background fill. Extracted from CommitStep's own
// (identically-shaped) private GlowBackdrop so the same touch can be reused
// on other headers without redrawing the same gradient SVG per screen;
// CommitStep's own defaults below match what it already shipped with, so
// pulling it out here changes nothing there. Purely decorative --
// pointerEvents="none" so it never intercepts touches meant for whatever
// renders on top of it.
export function GlowBackdrop({
  color = 'rgb(181,80,44)',
  left = -80,
  opacity = 0.35,
  size = 300,
  top = -60,
}: GlowBackdropProps) {
  return (
    <View
      className="absolute"
      pointerEvents="none"
      style={{ height: size, left, top, width: size }}
    >
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="glow-backdrop" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="70%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} fill="url(#glow-backdrop)" r={size / 2} />
      </Svg>
    </View>
  );
}

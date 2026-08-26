import { useId } from 'react';

// Ported from the mobile app's dancing-cactus glyph
// (../../../src/components/ui/spinner) -- same gradient shading, outline,
// and crown treatment. Kept in sync by hand since this is plain web
// SVG/CSS, not react-native-svg/reanimated, so there's nothing to import
// directly across the native/web boundary.
const DEFAULT_COLOR = 'rgb(110,127,74)';
const SPIKE_COLOR = 'rgb(201,138,58)';
const SHADE_COLOR = 'rgb(36,38,26)';
const SHINE_COLOR = 'rgb(244,239,224)';
const MOUTH_COLOR = 'rgb(58,50,34)';
const CROWN_COLOR = 'rgb(230,185,60)';

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

interface CactusMarkProps {
  className?: string;
  // Plays the same bouncy two-step as the mobile spinner (per-part CSS
  // animations -- see globals.css) instead of standing still. Off by
  // default so drop-in uses (legal page header, etc.) keep the calmer look.
  animated?: boolean;
}

export function CactusMark({ className, animated = false }: CactusMarkProps) {
  const uid = useId().replace(/:/g, '');
  const bodyGradientId = `${uid}-body`;
  const lensGradientId = `${uid}-lens`;
  const crownGradientId = `${uid}-crown`;
  const bodyStroke = shade(DEFAULT_COLOR, -0.35);
  const crownStroke = shade(CROWN_COLOR, -0.4);

  const cls = (...parts: Array<string | false>) => parts.filter(Boolean).join(' ');

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id={bodyGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={shade(DEFAULT_COLOR, 0.32)} />
          <stop offset="45%" stopColor={DEFAULT_COLOR} />
          <stop offset="100%" stopColor={shade(DEFAULT_COLOR, -0.22)} />
        </linearGradient>
        <linearGradient id={lensGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={shade(SHADE_COLOR, 0.55)} />
          <stop offset="100%" stopColor={shade(SHADE_COLOR, -0.3)} />
        </linearGradient>
        <linearGradient id={crownGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={shade(CROWN_COLOR, 0.35)} />
          <stop offset="45%" stopColor={CROWN_COLOR} />
          <stop offset="100%" stopColor={shade(CROWN_COLOR, -0.25)} />
        </linearGradient>
      </defs>

      <ellipse
        cx={12}
        cy={23}
        rx={7}
        ry={1.4}
        fill="#251e17"
        opacity={0.12}
        className={animated ? cls('cactus-pivot-shadow', 'animate-cactus-shadow') : undefined}
      />

      <g className={animated ? cls('cactus-pivot-body', 'animate-cactus-body') : undefined}>
        <g className={animated ? cls('cactus-pivot-arm-left', 'animate-cactus-arm-left') : undefined}>
          <rect x={3.5} y={6} width={3.4} height={8} rx={1.7} fill={`url(#${bodyGradientId})`} stroke={bodyStroke} strokeWidth={0.25} />
          <rect x={3.5} y={11.5} width={6.3} height={3.4} rx={1.7} fill={`url(#${bodyGradientId})`} stroke={bodyStroke} strokeWidth={0.25} />
          <rect x={4.1} y={6.8} width={0.8} height={6.4} rx={0.4} fill={SHINE_COLOR} opacity={0.22} />
          <g stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35}>
            <line x1={3.6} y1={7.5} x2={2.7} y2={7.1} />
            <line x1={3.6} y1={10.5} x2={2.7} y2={10.1} />
            <line x1={3.6} y1={13} x2={2.7} y2={12.6} />
          </g>
        </g>
        <g className={animated ? cls('cactus-pivot-arm-right', 'animate-cactus-arm-right') : undefined}>
          <rect x={17.1} y={2} width={3.4} height={8} rx={1.7} fill={`url(#${bodyGradientId})`} stroke={bodyStroke} strokeWidth={0.25} />
          <rect x={14.2} y={7.3} width={6.3} height={3.4} rx={1.7} fill={`url(#${bodyGradientId})`} stroke={bodyStroke} strokeWidth={0.25} />
          <rect x={17.7} y={2.8} width={0.8} height={6.4} rx={0.4} fill={SHINE_COLOR} opacity={0.22} />
          <g stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35}>
            <line x1={20.4} y1={3.5} x2={21.3} y2={3.1} />
            <line x1={20.4} y1={6} x2={21.3} y2={5.6} />
            <line x1={20.4} y1={8.5} x2={21.3} y2={8.1} />
          </g>
        </g>

        <rect x={9.3} y={5} width={5.4} height={17} rx={2.7} fill={`url(#${bodyGradientId})`} stroke={bodyStroke} strokeWidth={0.25} />
        <rect x={10} y={6} width={1} height={14.5} rx={0.5} fill={SHINE_COLOR} opacity={0.2} />

        <rect x={9.3} y={4.3} width={5.4} height={1.1} rx={0.4} fill={`url(#${crownGradientId})`} stroke={crownStroke} strokeWidth={0.25} />
        <path
          d="M 9.3 4.3 L 9.7 2.7 L 10.7 3.8 L 12 2.1 L 13.3 3.8 L 14.3 2.7 L 14.7 4.3 Z"
          fill={`url(#${crownGradientId})`}
          stroke={crownStroke}
          strokeWidth={0.25}
          strokeLinejoin="round"
        />
        <rect x={9.75} y={4.35} width={0.6} height={0.9} rx={0.2} fill={SHINE_COLOR} opacity={0.28} />
        <ellipse cx={12} cy={2.35} rx={0.28} ry={0.18} fill={SHINE_COLOR} opacity={0.85} />

        <g stroke={SPIKE_COLOR} strokeLinecap="round" strokeWidth={0.35}>
          <line x1={9.5} y1={13} x2={8.6} y2={13.5} />
          <line x1={9.5} y1={16} x2={8.6} y2={16.5} />
          <line x1={9.5} y1={19} x2={8.6} y2={19.5} />
          <line x1={14.5} y1={14.5} x2={15.4} y2={15} />
          <line x1={14.5} y1={17.5} x2={15.4} y2={18} />
          <line x1={14.5} y1={20.5} x2={15.4} y2={21} />
        </g>

        <rect x={9.3} y={8.2} width={0.6} height={0.4} rx={0.2} fill={SHADE_COLOR} />
        <rect x={14.15} y={8.2} width={0.6} height={0.4} rx={0.2} fill={SHADE_COLOR} />
        <rect x={11.55} y={8} width={0.9} height={0.55} rx={0.25} fill={SHADE_COLOR} />
        <circle cx={10.9} cy={8.4} r={1.05} fill={`url(#${lensGradientId})`} />
        <circle cx={13.1} cy={8.4} r={1.05} fill={`url(#${lensGradientId})`} />
        <ellipse cx={10.55} cy={8.05} rx={0.32} ry={0.2} fill={SHINE_COLOR} opacity={0.85} />
        <ellipse cx={12.75} cy={8.05} rx={0.32} ry={0.2} fill={SHINE_COLOR} opacity={0.85} />
        <path d="M 10.6 10.3 Q 12 11.3 13.4 10.3" stroke={MOUTH_COLOR} strokeLinecap="round" strokeWidth={0.55} fill="none" />
      </g>
    </svg>
  );
}

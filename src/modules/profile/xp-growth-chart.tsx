import { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';

import type { XpGrowthPoint } from './use-xp-growth';

const ACCENT = 'rgb(181,80,44)';
const CHART_HEIGHT = 160;
const PADDING_X = 4;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 8;

interface ChartGeometry {
  readonly line: string;
  readonly area: string;
  readonly lastX: number;
  readonly lastY: number;
}

// One point per week is already evenly spaced in time (see getXpGrowth's
// gap-filling), so an index-based x axis is exact -- no need to scale by
// real elapsed time between points.
function buildGeometry(points: readonly XpGrowthPoint[], width: number): ChartGeometry {
  const innerWidth = width - PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const floorY = PADDING_TOP + innerHeight;
  const maxXp = Math.max(1, ...points.map((point) => point.cumulativeXp));
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => ({
    x: PADDING_X + stepX * index,
    y: PADDING_TOP + innerHeight * (1 - point.cumulativeXp / maxXp),
  }));
  const last = coords[coords.length - 1];

  const line = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x},${coord.y}`)
    .join(' ');
  const area = `${line} L${last.x},${floorY} L${coords[0].x},${floorY} Z`;

  return { area, lastX: last.x, lastY: last.y, line };
}

export function XpGrowthChart({
  points,
}: {
  readonly points: readonly XpGrowthPoint[];
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  if (points.length === 0) {
    return null;
  }

  const last = points[points.length - 1];
  const geometry = width > 0 ? buildGeometry(points, width) : null;

  return (
    <VStack className="gap-1 px-5 pt-2" space="xs">
      <Text className="font-inter-semibold text-[11px] uppercase tracking-[1px] text-text-muted">
        Cumulative XP over time
      </Text>
      <Text className="font-inter-bold text-[24px] text-content">
        {last.cumulativeXp.toLocaleString()}
        <Text className="font-inter-semibold text-[13px] text-text-muted"> total XP</Text>
      </Text>
      <View onLayout={onLayout} style={{ height: CHART_HEIGHT, width: '100%' }}>
        {geometry ? (
          <Svg height={CHART_HEIGHT} width={width}>
            <Line
              stroke="rgba(37,30,23,0.08)"
              strokeWidth={1}
              x1={PADDING_X}
              x2={width - PADDING_X}
              y1={CHART_HEIGHT - PADDING_BOTTOM}
              y2={CHART_HEIGHT - PADDING_BOTTOM}
            />
            <Path d={geometry.area} fill="rgba(181,80,44,0.12)" />
            <Path
              d={geometry.line}
              fill="none"
              stroke={ACCENT}
              strokeLinecap="round"
              strokeWidth={2.5}
            />
            <Circle cx={geometry.lastX} cy={geometry.lastY} fill={ACCENT} r={4} />
          </Svg>
        ) : null}
      </View>
      <Text className="text-text-muted" size="xs">
        {formatDateOnly(points[0].weekStart)} – {formatDateOnly(last.weekStart)}
      </Text>
    </VStack>
  );
}

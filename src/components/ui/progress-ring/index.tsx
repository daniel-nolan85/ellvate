import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type ProgressRingProps = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  rounded?: boolean;
  children?: React.ReactNode;
};

const clampProgress = (value: number): number =>
  Math.min(1, Math.max(0, value));

function ProgressRing({
  progress,
  size = 74,
  strokeWidth = 6,
  color = 'rgb(99,102,241)',
  trackColor = 'rgba(250,250,250,0.15)',
  rounded = true,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth - 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampProgress(progress));

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={rounded ? 'round' : 'butt'}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      {children ? (
        <View className="absolute inset-0 items-center justify-center">
          {children}
        </View>
      ) : null}
    </View>
  );
}

export { ProgressRing };
export type { ProgressRingProps };

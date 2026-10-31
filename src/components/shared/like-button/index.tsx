import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

const COLOR_CONTENT = 'rgb(37,30,23)';
const COLOR_AMBER = 'rgb(217,123,41)';

const PARTICLE_COUNT = 6;
const PARTICLE_RADIUS = 18;
const PARTICLE_ANGLES = Array.from(
  { length: PARTICLE_COUNT },
  (_, index) => (index / PARTICLE_COUNT) * 2 * Math.PI,
);

function BurstParticle({
  angle,
  progress,
}: {
  readonly angle: number;
  readonly progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const distance = progress.value * PARTICLE_RADIUS;
    return {
      opacity: 1 - progress.value,
      transform: [
        { translateX: Math.cos(angle) * distance },
        { translateY: Math.sin(angle) * distance },
        { scale: 1 - progress.value * 0.4 },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -ml-[3px] -mt-[3px] rounded-full bg-amber"
      pointerEvents="none"
      style={style}
    />
  );
}

export interface LikeButtonProps {
  readonly liked: boolean;
  readonly likes: number;
  readonly onPress: () => void;
}

// The forum's like pill, with a small celebratory burst (an icon pop plus a
// handful of particles flying outward and fading) the moment a post goes
// from un-liked to liked. Pulled into its own component once the same bare
// pill needed the same new behavior in both the feed (post-card.tsx) and
// the post detail screen, rather than duplicating the animation in both --
// see AGENTS.md's "select an existing pattern before inventing structure".
//
// The burst only plays on the false->true transition (tracked via
// `wasLiked`, compared each render instead of re-running on mount), never
// on unlike and never on a re-render/refetch that leaves `liked` unchanged
// (e.g. a pull-to-refresh) -- so it reads as a direct response to the tap
// that caused it, not something that replays every time this card remounts
// already-liked.
export function LikeButton({ liked, likes, onPress }: LikeButtonProps) {
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);
  const wasLiked = useRef(liked);

  useEffect(() => {
    if (liked && !wasLiked.current) {
      scale.value = withSequence(
        withTiming(1.35, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 9, stiffness: 220 }),
      );
      burst.value = 0;
      burst.value = withTiming(1, {
        duration: 480,
        easing: Easing.out(Easing.quad),
      });
    }
    wasLiked.current = liked;
  }, [liked, scale, burst]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      accessibilityRole="button"
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-[7px] ${
        liked ? 'bg-amber-subtle' : 'bg-secondary'
      }`}
      onPress={onPress}
    >
      <Animated.View style={iconStyle}>
        <Icon
          color={liked ? COLOR_AMBER : COLOR_CONTENT}
          fill={liked ? COLOR_AMBER : 'none'}
          name="Favourite"
          size={14}
        />
        {PARTICLE_ANGLES.map((angle, index) => (
          <BurstParticle angle={angle} key={index} progress={burst} />
        ))}
      </Animated.View>
      <Text
        className={`font-inter-semibold text-[12px] leading-[16px] ${
          liked ? 'text-amber' : 'text-content'
        }`}
      >
        {likes}
      </Text>
    </Pressable>
  );
}

import { useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  CATEGORY_ACCENT_ICON_COLOR,
  CATEGORY_CHIP_ACTIVE_TREATMENT,
  type CategoryAccent,
} from '@/src/lib/category-accent';

const COUNT_UP_MS = 700;

// Ticks a displayed integer from its previous value up (or down) to `target`
// over COUNT_UP_MS, easing out -- plain requestAnimationFrame rather than
// Reanimated, since nothing here is gesture-driven or needs to run on the UI
// thread; a handful of RAF ticks moving a small integer is not something
// Reanimated's worklet machinery is needed for. Re-triggers on every change
// to `target` (e.g. a pull-to-refresh that changes a count), always
// animating from wherever the previous tick left off rather than resetting
// to 0 each time.
function useCountUp(target: number): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Skip the animation on first mount -- a card animating up from 0 the
    // instant this screen appears reads as loading-in-progress; only a
    // value that actually *changes* after that (a refresh, a new post)
    // should visibly count.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) {
      return;
    }
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / COUNT_UP_MS);
      const eased = 1 - (1 - t) * (1 - t);
      setValue(Math.round(from + delta * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

// A slow, subtle breathing pulse on the icon chip (scale + glow opacity) --
// the "always something gently alive" touch a static card lacks, without
// resorting to a scrolling ticker: nothing here moves the *number* itself,
// which stays perfectly legible the whole time. -1 repeat count means loop
// forever; the `true` reverses direction each cycle (yoyo) rather than
// snapping back to 0, so the motion has no visible seam.
function useBreathingPulse(): number {
  const shared = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useAnimatedReaction(
    () => shared.value,
    (value) => {
      runOnJS(setDisplay)(value);
    },
  );

  useEffect(() => {
    shared.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [shared]);

  return display;
}

export type StatChipCardSize = 'sm' | 'lg';

// 'lg': My Activity's fixed-width "hero" cards, shown 1-2 at a time.
// 'sm': a compact, flex-1 variant for a row showing several stats at once
// (e.g. Weekly Recap's 4-across row), where a fixed width per card isn't
// appropriate.
const SIZE_CONFIG: Readonly<
  Record<
    StatChipCardSize,
    {
      readonly card: string;
      readonly height: number;
      readonly chip: string;
      readonly iconSize: number;
      readonly number: string;
    }
  >
> = {
  lg: { card: 'w-[160px] gap-2.5 px-3 py-4', chip: 'h-11 w-11', height: 152, iconSize: 19, number: 'text-[26px]' },
  sm: { card: 'flex-1 gap-2 px-2 py-3.5', chip: 'h-9 w-9', height: 122, iconSize: 16, number: 'text-[20px]' },
};

function StatChipIcon({
  icon,
  size,
  tone,
}: {
  readonly icon: AppIconName;
  readonly size: StatChipCardSize;
  readonly tone: CategoryAccent;
}) {
  const pulse = useBreathingPulse();
  const config = SIZE_CONFIG[size];
  return (
    <Animated.View
      className={`items-center justify-center rounded-full ${config.chip} ${CATEGORY_CHIP_ACTIVE_TREATMENT[tone].bg}`}
      style={{ transform: [{ scale: 1 + pulse * 0.05 }] }}
    >
      <Icon color={CATEGORY_ACCENT_ICON_COLOR[tone]} name={icon} size={config.iconSize} />
    </Animated.View>
  );
}

export interface StatChipCardProps {
  readonly icon: AppIconName;
  readonly tone: CategoryAccent;
  readonly label: string;
  readonly value: number;
  readonly size?: StatChipCardSize;
}

// The shared icon-chip + count-up + breathing-pulse stat card, used
// wherever the app shows a small set of "what has this member/community
// done" numbers -- My Activity (size='lg', 1-2 cards for the active
// filter tab) and Weekly Recap (size='sm', 4 cards in one row). Pulled out
// once the same look was independently needed in both places, rather than
// duplicating it a third time -- see AGENTS.md's "select an existing
// pattern before inventing structure".
export function StatChipCard({ icon, label, size = 'lg', tone, value }: StatChipCardProps) {
  const displayValue = useCountUp(value);
  const config = SIZE_CONFIG[size];
  return (
    <VStack
      className={`items-center justify-center rounded-2xl border border-surface-hairline bg-paper shadow-card ${config.card}`}
      style={{ height: config.height }}
    >
      <StatChipIcon icon={icon} size={size} tone={tone} />
      <Text className={`font-inter-bold text-content ${config.number}`}>{displayValue}</Text>
      <Text className="text-center text-text-muted" numberOfLines={2} size="xs">
        {label}
      </Text>
    </VStack>
  );
}

import { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/text';

import type { NativeTimePickerProps } from './types';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 3;
const VIEWPORT_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const PERIODS = ['AM', 'PM'] as const;
type Period = (typeof PERIODS)[number];

const minutesForInterval = (interval: number): readonly number[] => {
  const steps: number[] = [];
  for (let minute = 0; minute < 60; minute += interval) {
    steps.push(minute);
  }
  return steps;
};

const pad = (value: number): string => String(value).padStart(2, '0');

interface WheelColumnProps<T> {
  readonly items: readonly T[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly renderLabel: (item: T) => string;
  readonly testID?: string;
}

function WheelColumn<T>({
  items,
  onSelect,
  renderLabel,
  selectedIndex,
  testID,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const lastIndex = useRef(selectedIndex);

  useEffect(() => {
    scrollRef.current?.scrollTo({ animated: false, y: selectedIndex * ROW_HEIGHT });
    // Only run once on mount to set the initial scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitIndex = (rawIndex: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, rawIndex));
    if (clamped !== lastIndex.current) {
      lastIndex.current = clamped;
      void Haptics.selectionAsync();
      onSelect(clamped);
    }
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    commitIndex(Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT));
  };

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ animated: true, y: index * ROW_HEIGHT });
    commitIndex(index);
  };

  return (
    <View style={{ height: VIEWPORT_HEIGHT }} className='flex-1 overflow-hidden'>
      <ScrollView
        decelerationRate='fast'
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        testID={testID}
      >
        <View style={{ height: ROW_HEIGHT }} />
        {items.map((item, index) => (
          <Pressable
            key={renderLabel(item)}
            className='items-center justify-center'
            onPress={() => scrollToIndex(index)}
            style={{ height: ROW_HEIGHT }}
          >
            <Text
              className={
                index === selectedIndex
                  ? 'font-inter-bold text-[18px] text-content'
                  : 'text-[16px] text-text-muted'
              }
            >
              {renderLabel(item)}
            </Text>
          </Pressable>
        ))}
        <View style={{ height: ROW_HEIGHT }} />
      </ScrollView>
    </View>
  );
}

export function WheelTimePicker({
  accessibilityLabel,
  minuteInterval = 15,
  onChange,
  testID,
  value,
}: NativeTimePickerProps) {
  const minutes = minutesForInterval(minuteInterval);
  const hour24 = value.getHours();
  const period: Period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = ((hour24 + 11) % 12) + 1;
  const closestMinuteIndex = minutes.reduce(
    (closest, candidate, index) =>
      Math.abs(candidate - value.getMinutes()) <
      Math.abs(minutes[closest] - value.getMinutes())
        ? index
        : closest,
    0,
  );

  const applyChange = (
    nextHour12: number,
    nextMinute: number,
    nextPeriod: Period,
  ) => {
    const next = new Date(value);
    const hours24 =
      nextPeriod === 'PM'
        ? (nextHour12 % 12) + 12
        : nextHour12 % 12;
    next.setHours(hours24, nextMinute, 0, 0);
    onChange(next);
  };

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      className='flex-row overflow-hidden rounded-lg border border-line bg-canvas'
      testID={testID}
    >
      <View
        className='absolute left-0 right-0 rounded-md bg-secondary'
        style={{ height: ROW_HEIGHT, top: ROW_HEIGHT }}
        pointerEvents='none'
      />
      <WheelColumn
        items={HOURS}
        onSelect={(index) => applyChange(HOURS[index], minutes[closestMinuteIndex], period)}
        renderLabel={(item) => pad(item)}
        selectedIndex={hour12 - 1}
        testID={testID ? `${testID}-hour` : undefined}
      />
      <WheelColumn
        items={minutes}
        onSelect={(index) => applyChange(hour12, minutes[index], period)}
        renderLabel={(item) => pad(item)}
        selectedIndex={closestMinuteIndex}
        testID={testID ? `${testID}-minute` : undefined}
      />
      <WheelColumn
        items={PERIODS}
        onSelect={(index) =>
          applyChange(hour12, minutes[closestMinuteIndex], PERIODS[index])
        }
        renderLabel={(item) => item}
        selectedIndex={PERIODS.indexOf(period)}
        testID={testID ? `${testID}-period` : undefined}
      />
    </View>
  );
}

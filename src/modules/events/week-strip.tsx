import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/src/components/ui/text';

import type { WeekDay } from './events-types';

interface WeekStripProps {
  readonly week: readonly WeekDay[];
}

export function WeekStrip({ week }: WeekStripProps) {
  const [selectedDate, setSelectedDate] = useState(
    () => week.find((day) => day.isToday)?.date ?? week[0]?.date ?? '',
  );

  return (
    <ScrollView
      contentContainerClassName="gap-1.5 px-5 py-0.5"
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {week.map((day) => {
        const selected = day.date === selectedDate;

        return (
          <Pressable
            accessibilityRole="button"
            className={`w-[46px] items-center gap-[3px] rounded-[16px] py-2.5 ${
              selected ? 'bg-primary' : 'border border-line'
            }`}
            key={day.date}
            onPress={() => setSelectedDate(day.date)}
          >
            <Text
              className={`font-inter-semibold text-[10px] leading-[12px] tracking-[0.5px] ${
                selected ? 'text-[rgba(250,250,250,0.6)]' : 'text-text-subtle'
              }`}
            >
              {day.dayLabel}
            </Text>
            <Text
              className={`font-inter-bold text-[17px] leading-[20px] ${
                selected ? 'text-primary-foreground' : 'text-content'
              }`}
            >
              {day.dateLabel}
            </Text>
            {day.isToday ? (
              <View className="h-1 w-1 rounded-full bg-indigo" />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

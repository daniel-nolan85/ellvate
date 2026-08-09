import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DateCalendar } from '@/src/components/shared/date-calendar';
import type { CalendarMarkers } from '@/src/components/ui/calendar';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  dateOnlyFromDate,
  dateOnlyToDate,
  formatDateOnly,
} from '@/src/lib/date-only';

const EVENT_MARKER_COLOR = 'rgb(181,80,44)';

interface EventsCalendarProps {
  // Calendar day (YYYY-MM-DD) of every upcoming event -- just dates, not
  // full events, since the calendar only ever needs to place a marker.
  readonly dates: readonly string[];
  readonly onSelectedDateChange: (value: string | null) => void;
  readonly selectedDate: string | null;
}

export function EventsCalendar({
  dates,
  onSelectedDateChange,
  selectedDate,
}: EventsCalendarProps) {
  const [expanded, setExpanded] = useState(false);

  const markers = useMemo<CalendarMarkers>(() => {
    const result: CalendarMarkers = {};
    for (const date of dates) {
      result[date] = {
        color: EVENT_MARKER_COLOR,
        type: 'dot',
      };
    }
    return result;
  }, [dates]);

  const selectedValue = selectedDate ? dateOnlyToDate(selectedDate) : undefined;
  const initialMonth = selectedValue ??
    dateOnlyToDate(dates[0] ?? '') ??
    new Date();
  const monthLabel = formatDateOnly(dateOnlyFromDate(initialMonth), {
    month: 'long',
    year: 'numeric',
  });

  return (
    <VStack className="px-5" space="xs" testID="events-calendar">
      <Pressable
        accessibilityLabel={expanded ? 'Collapse calendar' : 'Expand calendar'}
        accessibilityRole="button"
        className="flex-row items-center justify-between rounded-[14px] border border-surface-hairline bg-paper px-4 py-3 shadow-card"
        onPress={() => setExpanded((current) => !current)}
        testID="events-calendar-toggle"
      >
        <HStack className="items-center" space="sm">
          <Icon color="rgb(181,80,44)" name="CalendarDays" size={16} />
          <Text className="font-inter-semibold text-[14px] text-content">
            {monthLabel}
          </Text>
        </HStack>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={18} />
      </Pressable>

      {expanded ? (
        <View testID="events-calendar-grid">
          <DateCalendar
            initialMonth={initialMonth}
            markers={markers}
            onChange={(date) => onSelectedDateChange(dateOnlyFromDate(date))}
            testID="events-date-calendar"
            value={selectedValue ?? undefined}
          />
        </View>
      ) : null}

      <HStack className="items-center justify-between px-1">
        <Text className="text-text-muted" size="xs" testID="events-calendar-filter">
          {selectedDate
            ? `Showing ${formatDateOnly(selectedDate, { day: 'numeric', month: 'long' })}`
            : 'Showing all upcoming events'}
        </Text>
        {selectedDate ? (
          <Pressable
            accessibilityLabel="Show all events"
            accessibilityRole="button"
            onPress={() => onSelectedDateChange(null)}
            testID="events-calendar-clear"
          >
            <Text className="font-inter-semibold text-accent" size="xs">
              Show all
            </Text>
          </Pressable>
        ) : null}
      </HStack>
    </VStack>
  );
}

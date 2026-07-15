import { useMemo } from 'react';
import { Pressable } from 'react-native';

import { DateCalendar } from '@/src/components/shared/date-calendar';
import type { CalendarMarkers } from '@/src/components/ui/calendar';
import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  dateOnlyFromDate,
  dateOnlyToDate,
  formatDateOnly,
} from '@/src/lib/date-only';

import type { CommunityEvent } from './events-types';

const EVENT_MARKER_COLOR = 'rgb(99,102,241)';

interface EventsCalendarProps {
  readonly events: readonly CommunityEvent[];
  readonly onSelectedDateChange: (value: string | null) => void;
  readonly selectedDate: string | null;
}

export function EventsCalendar({
  events,
  onSelectedDateChange,
  selectedDate,
}: EventsCalendarProps) {
  const markers = useMemo<CalendarMarkers>(() => {
    const result: CalendarMarkers = {};
    for (const event of events) {
      result[event.startsAt.slice(0, 10)] = {
        color: EVENT_MARKER_COLOR,
        type: 'dot',
      };
    }
    return result;
  }, [events]);

  const selectedValue = selectedDate ? dateOnlyToDate(selectedDate) : undefined;
  const initialMonth = selectedValue ??
    dateOnlyToDate(events[0]?.startsAt.slice(0, 10) ?? '') ??
    new Date();

  return (
    <VStack className="px-5" space="xs">
      <DateCalendar
        initialMonth={initialMonth}
        markers={markers}
        onChange={(date) => onSelectedDateChange(dateOnlyFromDate(date))}
        testID="events-calendar"
        value={selectedValue ?? undefined}
      />
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
            <Text className="font-inter-semibold text-indigo" size="xs">
              Show all
            </Text>
          </Pressable>
        ) : null}
      </HStack>
    </VStack>
  );
}

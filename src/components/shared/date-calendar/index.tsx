import type { CalendarMarkers } from '@gluestack-ui/core/calendar/creator';

import {
  Calendar,
  CalendarBody,
  CalendarGrid,
  CalendarHeader,
  CalendarHeaderNextButton,
  CalendarHeaderPrevButton,
  CalendarHeaderTitle,
  CalendarWeekDaysHeader,
} from '@/src/components/ui/calendar';
import { Icon } from '@/src/components/ui/icon';

interface DateCalendarProps {
  readonly initialMonth?: Date;
  readonly markers?: CalendarMarkers;
  readonly maxDate?: Date;
  readonly minDate?: Date;
  readonly onChange: (date: Date) => void;
  readonly testID: string;
  readonly value?: Date;
}

export function DateCalendar({
  initialMonth,
  markers,
  maxDate,
  minDate,
  onChange,
  testID,
  value,
}: DateCalendarProps) {
  return (
    <Calendar
      initialMonth={initialMonth ?? value}
      markers={markers}
      maxDate={maxDate}
      minDate={minDate}
      mode="single"
      onValueChange={onChange}
      testID={testID}
      value={value}
    >
      <CalendarHeader>
        <CalendarHeaderPrevButton
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          testID={`${testID}-previous-month`}
        >
          <Icon name="ChevronLeft" size={18} />
        </CalendarHeaderPrevButton>
        <CalendarHeaderTitle />
        <CalendarHeaderNextButton
          accessibilityLabel="Next month"
          accessibilityRole="button"
          testID={`${testID}-next-month`}
        >
          <Icon name="ChevronRight" size={18} />
        </CalendarHeaderNextButton>
      </CalendarHeader>
      <CalendarWeekDaysHeader format="narrow" />
      <CalendarBody>
        <CalendarGrid />
      </CalendarBody>
    </Calendar>
  );
}

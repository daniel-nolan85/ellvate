import DateTimePicker from '@react-native-community/datetimepicker';

import { formatNativeTime } from './format-time';

import type { NativeTimePickerProps } from './types';

export function NativeTimePicker({
  accessibilityLabel,
  minuteInterval = 15,
  onChange,
  testID,
  value,
}: NativeTimePickerProps) {
  return (
    <DateTimePicker
      accessibilityLabel={`${accessibilityLabel}, ${formatNativeTime(value)}`}
      display="compact"
      minuteInterval={minuteInterval}
      mode="time"
      onChange={(event, selectedValue) => {
        if (event.type === 'set' && selectedValue) {
          onChange(selectedValue);
        }
      }}
      testID={testID}
      value={value}
    />
  );
}

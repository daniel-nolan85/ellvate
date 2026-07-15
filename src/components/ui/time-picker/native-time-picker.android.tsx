import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { formatNativeTime } from './format-time';

import type { NativeTimePickerProps } from './types';

export function NativeTimePicker({
  accessibilityLabel,
  minuteInterval = 15,
  onChange,
  testID,
  value,
}: NativeTimePickerProps) {
  const formattedValue = formatNativeTime(value);

  return (
    <Pressable
      accessibilityLabel={`${accessibilityLabel}, ${formattedValue}`}
      accessibilityRole="button"
      className="rounded-2xl border border-line bg-canvas px-4 py-3"
      onPress={() =>
        DateTimePickerAndroid.open({
          display: 'default',
          minuteInterval,
          mode: 'time',
          onChange: (event, selectedValue) => {
            if (event.type === 'set' && selectedValue) {
              onChange(selectedValue);
            }
          },
          testID: `${testID}-dialog`,
          value,
        })
      }
      testID={testID}
    >
      <HStack className="items-center justify-between">
        <Text className="font-inter-medium text-base text-content">
          {formattedValue}
        </Text>
        <Icon className="text-text-muted" name="Clock" size={18} />
      </HStack>
    </Pressable>
  );
}

import { useEffect, useState } from 'react';

import { Input, InputField } from '@/src/components/ui/input';
import { timeOnlyFromDate, timeOnlyToDate } from '@/src/lib/time-only';

import type { NativeTimePickerProps } from './types';

export function NativeTimePicker({
  accessibilityLabel,
  onChange,
  testID,
  value,
}: NativeTimePickerProps) {
  const [draft, setDraft] = useState(() => timeOnlyFromDate(value));

  useEffect(() => {
    setDraft(timeOnlyFromDate(value));
  }, [value]);

  return (
    <Input size="lg">
      <InputField
        accessibilityLabel={accessibilityLabel}
        inputMode="numeric"
        maxLength={5}
        onBlur={() => setDraft(timeOnlyFromDate(value))}
        onChangeText={(nextValue) => {
          const nextDraft = nextValue.replace(/[^\d:]/g, '').slice(0, 5);
          setDraft(nextDraft);
          const parsed = timeOnlyToDate(nextDraft, value);
          if (parsed) {
            onChange(parsed);
          }
        }}
        placeholder="HH:MM"
        testID={testID}
        value={draft}
      />
    </Input>
  );
}

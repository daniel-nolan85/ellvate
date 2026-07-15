import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { DateCalendar } from '@/src/components/shared/date-calendar';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { NativeTimePicker } from '@/src/components/ui/time-picker';
import { VStack } from '@/src/components/ui/vstack';
import { dateOnlyFromDate } from '@/src/lib/date-only';
import { timeOnlyFromDate } from '@/src/lib/time-only';

import type { CreateEventInput } from './events-types';

const TAGS = [
  'Social',
  'Fitness',
  'Family',
  'Music',
  'Market',
  'Community',
  'Outdoors',
  'Wellness',
] as const;

interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string;
}

function Chip({ label, onPress, selected, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full px-3.5 py-2 ${selected ? 'bg-primary' : 'bg-secondary'}`}
      onPress={onPress}
      testID={testID}
    >
      <Text
        className={`font-inter-medium text-[13px] ${selected ? 'text-primary-foreground' : 'text-content'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return (
    <VStack space="xs">
      <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
        {label}
      </Text>
      {children}
    </VStack>
  );
}

interface EventComposerProps {
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (input: CreateEventInput) => void;
}

const startOfToday = (): Date => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const oneYearAfter = (date: Date): Date => {
  const value = new Date(date);
  value.setFullYear(value.getFullYear() + 1);
  return value;
};

const nextQuarterHour = (): Date => {
  const value = new Date();
  value.setSeconds(0, 0);
  const remainder = value.getMinutes() % 15;
  if (remainder !== 0) {
    value.setMinutes(value.getMinutes() + 15 - remainder);
  }
  return value;
};

export function EventComposer({
  isSubmitting,
  onDismiss,
  onSubmit,
}: EventComposerProps) {
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [tag, setTag] = useState<string>('');
  const [today] = useState(startOfToday);
  const [maxDate] = useState(() => oneYearAfter(today));
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nextQuarterHour);

  const canSubmit =
    title.trim().length > 0 &&
    place.trim().length > 0 &&
    tag.length > 0 &&
    !isSubmitting;

  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <VStack className="px-5 pb-2 pt-1" space="md">
        <Text className="font-inter-bold text-[17px] text-content">
          New event at the lake
        </Text>

        <Field label="What is it?">
          <Input size="lg">
            <InputField
              onChangeText={setTitle}
              placeholder="Event name"
              testID="event-title"
              value={title}
            />
          </Input>
        </Field>

        <Field label="Where?">
          <Input size="lg">
            <InputField
              onChangeText={setPlace}
              placeholder="Place or venue"
              testID="event-place"
              value={place}
            />
          </Input>
        </Field>

        <Field label="Type">
          <HStack className="flex-wrap gap-2">
            {TAGS.map((option) => (
              <Chip
                key={option}
                label={option}
                onPress={() => setTag(option)}
                selected={tag === option}
                testID={`event-category-${option.toLowerCase()}`}
              />
            ))}
          </HStack>
        </Field>

        <Field label="Day">
          <DateCalendar
            maxDate={maxDate}
            minDate={today}
            onChange={setDate}
            testID="event-date-calendar"
            value={date}
          />
        </Field>

        <Field label="Time">
          <NativeTimePicker
            accessibilityLabel="Event time"
            minuteInterval={15}
            onChange={setTime}
            testID="event-time-picker"
            value={time}
          />
        </Field>

        <HStack className="items-center justify-end" space="sm">
          <Button
            action="secondary"
            isDisabled={isSubmitting}
            onPress={onDismiss}
            size="sm"
            testID="event-cancel"
            variant="link"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-text-muted">
              Cancel
            </ButtonText>
          </Button>
          <Button
            className="rounded-full bg-primary px-5"
            isDisabled={!canSubmit}
            onPress={() =>
              onSubmit({
                date: dateOnlyFromDate(date),
                place: place.trim(),
                tag,
                time: timeOnlyFromDate(time),
                title: title.trim(),
              })
            }
            testID="event-submit"
            size="sm"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-primary-foreground">
              {isSubmitting ? 'Adding…' : 'Add event'}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>
    </ScrollView>
  );
}

import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import type { CreateEventInput, WeekDay } from './events-types';

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

const TIMES: readonly { readonly label: string; readonly value: string }[] = [
  { label: '8 AM', value: '08:00' },
  { label: '10 AM', value: '10:00' },
  { label: '12 PM', value: '12:00' },
  { label: '2 PM', value: '14:00' },
  { label: '4 PM', value: '16:00' },
  { label: '6 PM', value: '18:00' },
  { label: '8 PM', value: '20:00' },
];

interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}

function Chip({ label, onPress, selected }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`rounded-full px-3.5 py-2 ${selected ? 'bg-primary' : 'bg-secondary'}`}
      onPress={onPress}
    >
      <Text
        className={`font-inter-medium text-[13px] ${selected ? 'text-primary-foreground' : 'text-content'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
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
  readonly week: readonly WeekDay[];
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (input: CreateEventInput) => void;
}

export function EventComposer({
  isSubmitting,
  onDismiss,
  onSubmit,
  week,
}: EventComposerProps) {
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [tag, setTag] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');

  const canSubmit =
    title.trim().length > 0 &&
    place.trim().length > 0 &&
    tag.length > 0 &&
    date.length > 0 &&
    time.length > 0 &&
    !isSubmitting;

  return (
    <VStack
      className="mx-5 rounded-[20px] border border-line bg-canvas p-[18px]"
      space="md"
    >
      <Text className="font-inter-semibold text-[13px] text-text-muted">
        New event at the lake
      </Text>

      <Field label="What is it?">
        <Input size="lg">
          <InputField
            autoFocus
            onChangeText={setTitle}
            placeholder="Event name"
            value={title}
          />
        </Input>
      </Field>

      <Field label="Where?">
        <Input size="lg">
          <InputField
            onChangeText={setPlace}
            placeholder="Place or venue"
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
            />
          ))}
        </HStack>
      </Field>

      <Field label="Day">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {week.map((day) => (
            <Chip
              key={day.date}
              label={`${day.dayLabel} ${day.dateLabel}`}
              onPress={() => setDate(day.date)}
              selected={date === day.date}
            />
          ))}
        </ScrollView>
      </Field>

      <Field label="Time">
        <HStack className="flex-wrap gap-2">
          {TIMES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              onPress={() => setTime(option.value)}
              selected={time === option.value}
            />
          ))}
        </HStack>
      </Field>

      <HStack className="items-center justify-end" space="sm">
        <Button
          action="secondary"
          isDisabled={isSubmitting}
          onPress={onDismiss}
          size="sm"
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
            onSubmit({ date, place: place.trim(), tag, time, title: title.trim() })
          }
          size="sm"
        >
          <ButtonText className="font-inter-semibold text-[13px] text-primary-foreground">
            {isSubmitting ? 'Adding…' : 'Add event'}
          </ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

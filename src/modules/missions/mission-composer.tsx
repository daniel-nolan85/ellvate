import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { DateCalendar } from '@/src/components/shared/date-calendar';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { dateOnlyFromDate } from '@/src/lib/date-only';

import type { CreateMissionInput, MissionIcon } from './use-missions';

const XP_OPTIONS = [25, 50, 75, 100, 150] as const;
const STOP_OPTIONS = [1, 2, 3, 4, 5] as const;
const ICON_OPTIONS: readonly { readonly icon: MissionIcon; readonly label: string }[] = [
  { icon: 'Sun', label: 'Day' },
  { icon: 'ArrowUp', label: 'Trail' },
  { icon: 'Star', label: 'Star' },
  { icon: 'Moon', label: 'Night' },
];

interface ChipProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly selected: boolean;
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

interface MissionComposerProps {
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (input: CreateMissionInput) => void;
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

export function MissionComposer({
  isSubmitting,
  onDismiss,
  onSubmit,
}: MissionComposerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [xp, setXp] = useState<number | null>(null);
  const [stopsTotal, setStopsTotal] = useState<number | null>(null);
  const [icon, setIcon] = useState<MissionIcon | null>(null);
  const [today] = useState(startOfToday);
  const [maxDate] = useState(() => oneYearAfter(today));
  const [scheduledFor, setScheduledFor] = useState(today);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    xp !== null &&
    stopsTotal !== null &&
    icon !== null &&
    !isSubmitting;

  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <VStack className="px-5 pb-2 pt-1" space="md">
        <Text className="font-inter-bold text-[17px] text-content">
          New mission around the lake
        </Text>

        <Field label="Name it">
          <Input size="lg">
            <InputField
              onChangeText={setTitle}
              placeholder="Mission name"
              testID="mission-title"
              value={title}
            />
          </Input>
        </Field>

        <Field label="What to do">
          <Input size="lg">
            <InputField
              onChangeText={setDescription}
              placeholder="Describe the challenge"
              testID="mission-description"
              value={description}
            />
          </Input>
        </Field>

        <Field label="Scheduled for">
          <DateCalendar
            maxDate={maxDate}
            minDate={today}
            onChange={setScheduledFor}
            testID="mission-date-calendar"
            value={scheduledFor}
          />
        </Field>

        <Field label="Reward (XP)">
          <HStack className="flex-wrap gap-2">
            {XP_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={`${option} XP`}
                onPress={() => setXp(option)}
                selected={xp === option}
                testID={`mission-xp-${option}`}
              />
            ))}
          </HStack>
        </Field>

        <Field label="Stops">
          <HStack className="flex-wrap gap-2">
            {STOP_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={String(option)}
                onPress={() => setStopsTotal(option)}
                selected={stopsTotal === option}
                testID={`mission-stops-${option}`}
              />
            ))}
          </HStack>
        </Field>

        <Field label="Icon">
          <HStack className="flex-wrap gap-2">
            {ICON_OPTIONS.map((option) => {
              const active = icon === option.icon;
              return (
                <Pressable
                  accessibilityLabel={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`h-11 w-11 items-center justify-center rounded-full ${active ? 'bg-primary' : 'bg-secondary'}`}
                  key={option.icon}
                  onPress={() => setIcon(option.icon)}
                  testID={`mission-icon-${option.icon.toLowerCase()}`}
                >
                  <Icon
                    color={active ? '#fff' : 'rgb(63,63,70)'}
                    name={option.icon}
                    size={18}
                  />
                </Pressable>
              );
            })}
          </HStack>
        </Field>

        <HStack className="items-center justify-end" space="sm">
          <Button
            action="secondary"
            isDisabled={isSubmitting}
            onPress={onDismiss}
            size="sm"
            testID="mission-cancel"
            variant="link"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-text-muted">
              Cancel
            </ButtonText>
          </Button>
          <Button
            className="rounded-full bg-primary px-5"
            isDisabled={!canSubmit}
            onPress={() => {
              if (xp === null || stopsTotal === null || icon === null) {
                return;
              }
              onSubmit({
                description: description.trim(),
                icon,
                scheduledFor: dateOnlyFromDate(scheduledFor),
                stopsTotal,
                title: title.trim(),
                xp,
              });
            }}
            testID="mission-submit"
            size="sm"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-primary-foreground">
              {isSubmitting ? 'Adding…' : 'Add mission'}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>
    </ScrollView>
  );
}

import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import type { CreateMissionInput, MissionIcon } from './use-missions';

const XP_OPTIONS = [25, 50, 75, 100, 150] as const;
const STOP_OPTIONS = [1, 2, 3, 4, 5] as const;
const ICON_OPTIONS: readonly { readonly icon: MissionIcon; readonly label: string }[] =
  [
    { icon: 'Sun', label: 'Day' },
    { icon: 'ArrowUp', label: 'Trail' },
    { icon: 'Star', label: 'Star' },
    { icon: 'Moon', label: 'Night' },
  ];

function Chip({
  label,
  onPress,
  selected,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly selected: boolean;
}) {
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

function Field({
  children,
  label,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
}) {
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

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    xp !== null &&
    stopsTotal !== null &&
    icon !== null &&
    !isSubmitting;

  return (
    <VStack
      className="mx-5 rounded-[20px] border border-line bg-canvas p-[18px]"
      space="md"
    >
      <Text className="font-inter-semibold text-[13px] text-text-muted">
        New mission around the lake
      </Text>

      <Field label="Name it">
        <Input size="lg">
          <InputField
            autoFocus
            onChangeText={setTitle}
            placeholder="Mission name"
            value={title}
          />
        </Input>
      </Field>

      <Field label="What to do">
        <Input size="lg">
          <InputField
            onChangeText={setDescription}
            placeholder="Describe the challenge"
            value={description}
          />
        </Input>
      </Field>

      <Field label="Reward (XP)">
        <HStack className="flex-wrap gap-2">
          {XP_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={`${option} XP`}
              onPress={() => setXp(option)}
              selected={xp === option}
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
                className={`h-11 w-11 items-center justify-center rounded-full ${active ? 'bg-primary' : 'bg-secondary'}`}
                key={option.icon}
                onPress={() => setIcon(option.icon)}
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
              stopsTotal,
              title: title.trim(),
              xp,
            });
          }}
          size="sm"
        >
          <ButtonText className="font-inter-semibold text-[13px] text-primary-foreground">
            {isSubmitting ? 'Adding…' : 'Add mission'}
          </ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

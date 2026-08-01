import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { DateCalendar } from '@/src/components/shared/date-calendar';
import { Button, ButtonText } from '@/src/components/ui/button';
import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { dateOnlyFromDate, dateOnlyToDate } from '@/src/lib/date-only';
import { pickGalleryImages } from '@/src/platform/media-picker';

import type { MissionIcon } from './use-missions';

export interface MissionComposerDraft {
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string;
  readonly xp: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
  readonly existingMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly newMedia?: readonly { readonly filename: string; readonly dataUrl: string }[];
}

interface ExistingMissionMediaItem {
  readonly kind: 'existing';
  readonly filename: string;
  readonly url: string;
}

interface NewMissionMediaItem {
  readonly kind: 'new';
  readonly uri: string;
  readonly base64: string;
  readonly filename: string;
  readonly mimeType: string;
}

type MissionMediaItem = ExistingMissionMediaItem | NewMissionMediaItem;

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
      className={`rounded-full px-3.5 py-2 ${selected ? 'bg-accent' : 'bg-secondary'}`}
      onPress={onPress}
      testID={testID}
    >
      <Text
        className={`font-inter-medium text-[13px] ${selected ? 'text-accent-foreground' : 'text-content'}`}
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
  readonly onSubmit: (draft: MissionComposerDraft) => void;
  readonly initialTitle?: string;
  readonly initialDescription?: string;
  readonly initialScheduledFor?: string;
  readonly initialXp?: number | null;
  readonly initialStopsTotal?: number | null;
  readonly initialIcon?: MissionIcon | null;
  readonly initialMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly submitLabel?: string;
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
  initialDescription = '',
  initialIcon = null,
  initialMedia,
  initialScheduledFor,
  initialStopsTotal = null,
  initialTitle = '',
  initialXp = null,
  isSubmitting,
  onDismiss,
  onSubmit,
  submitLabel = 'Add mission',
}: MissionComposerProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [xp, setXp] = useState<number | null>(initialXp);
  const [stopsTotal, setStopsTotal] = useState<number | null>(initialStopsTotal);
  const [icon, setIcon] = useState<MissionIcon | null>(initialIcon);
  const [today] = useState(startOfToday);
  const [maxDate] = useState(() => oneYearAfter(today));
  const [scheduledFor, setScheduledFor] = useState(
    () => (initialScheduledFor && dateOnlyToDate(initialScheduledFor)) || today,
  );
  const [media, setMedia] = useState<readonly MissionMediaItem[]>(
    () =>
      initialMedia?.map((item) => ({
        filename: item.filename,
        kind: 'existing' as const,
        url: item.url,
      })) ?? [],
  );
  const [alertTitle, setAlertTitle] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    xp !== null &&
    stopsTotal !== null &&
    icon !== null &&
    !isSubmitting;

  const showAlert = (nextTitle: string, message: string) => {
    setAlertTitle(nextTitle);
    setAlertMessage(message);
  };

  const pickImage = async () => {
    const remaining = 10 - media.length;
    if (remaining <= 0) {
      showAlert('Limit reached', 'You can upload up to 10 files per mission');
      return;
    }

    const picked = await pickGalleryImages({ selectionLimit: remaining });
    const newMedia: readonly MissionMediaItem[] = picked.map((asset) => ({
      ...asset,
      kind: 'new' as const,
    }));
    setMedia([...media, ...newMedia]);
  };

  const removeMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <VStack className="px-5 pb-2 pt-1" space="md">
        <Text className="font-inter-bold text-[17px] text-content">
          {submitLabel === 'Add mission' ? 'New mission around the lake' : 'Edit mission'}
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
          <GrowingTextInput
            className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-content"
            maxHeight={200}
            onChangeText={setDescription}
            placeholder="Describe the challenge"
            testID="mission-description"
            value={description}
          />
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
                  className={`h-11 w-11 items-center justify-center rounded-full ${active ? 'bg-accent' : 'bg-secondary'}`}
                  key={option.icon}
                  onPress={() => setIcon(option.icon)}
                  testID={`mission-icon-${option.icon.toLowerCase()}`}
                >
                  <Icon
                    color={active ? '#fff' : 'rgb(37,30,23)'}
                    name={option.icon}
                    size={18}
                  />
                </Pressable>
              );
            })}
          </HStack>
        </Field>

        <Field label="Photos">
          {media.length > 0 ? (
            <VStack space="xs">
              <Text className="text-xs text-text-muted">
                {media.length}/10 files
              </Text>
              <HStack className="flex-wrap gap-2">
                {media.map((item, index) => (
                  <View
                    key={item.kind === 'existing' ? item.url : item.uri}
                    className="relative h-20 w-20 overflow-hidden rounded-lg bg-secondary"
                  >
                    <Image
                      source={{ uri: item.kind === 'existing' ? item.url : item.uri }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                    <Pressable
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500"
                      onPress={() => removeMedia(index)}
                    >
                      <Icon color="white" name="Close" size={14} />
                    </Pressable>
                  </View>
                ))}
                {media.length < 10 && (
                  <Pressable
                    className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-line bg-secondary"
                    onPress={pickImage}
                  >
                    <Icon color="rgb(169,156,139)" name="Add" size={20} />
                  </Pressable>
                )}
              </HStack>
            </VStack>
          ) : (
            <Pressable
              className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-secondary px-3 py-3"
              onPress={pickImage}
            >
              <Icon color="rgb(169,156,139)" name="Image" size={20} />
            </Pressable>
          )}
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
            className="rounded-full bg-accent px-5"
            isDisabled={!canSubmit}
            onPress={() => {
              if (xp === null || stopsTotal === null || icon === null) {
                return;
              }
              onSubmit({
                description: description.trim(),
                existingMedia: media
                  .filter((item): item is ExistingMissionMediaItem => item.kind === 'existing')
                  .map((item) => ({ filename: item.filename, url: item.url })),
                icon,
                newMedia: media
                  .filter((item): item is NewMissionMediaItem => item.kind === 'new')
                  .map((item) => ({
                    dataUrl: `data:${item.mimeType};base64,${item.base64}`,
                    filename: item.filename,
                  })),
                scheduledFor: dateOnlyFromDate(scheduledFor),
                stopsTotal,
                title: title.trim(),
                xp,
              });
            }}
            testID="mission-submit"
            size="sm"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
              {isSubmitting ? 'Saving…' : submitLabel}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>

      <Modal
        animationType="fade"
        onRequestClose={() => setAlertTitle(null)}
        transparent
        visible={!!alertTitle}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8"
          onPress={() => setAlertTitle(null)}
        >
          <Pressable
            className="w-full gap-3 rounded-[20px] bg-canvas p-5"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="font-inter-bold text-[17px] text-content">
              {alertTitle}
            </Text>
            <Text className="text-text-muted" size="sm">
              {alertMessage}
            </Text>
            <HStack className="justify-end">
              <Pressable onPress={() => setAlertTitle(null)}>
                <Text className="font-inter-semibold text-[15px] text-primary">
                  OK
                </Text>
              </Pressable>
            </HStack>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

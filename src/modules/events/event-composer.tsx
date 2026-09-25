import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { DateCalendar } from '@/src/components/shared/date-calendar';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { NativeTimePicker } from '@/src/components/ui/time-picker';
import { VStack } from '@/src/components/ui/vstack';
import { dateOnlyFromDate } from '@/src/lib/date-only';
import { timeOnlyFromDate } from '@/src/lib/time-only';
import { pickGalleryImages } from '@/src/platform/media-picker';

export interface EventComposerDraft {
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly date: string;
  readonly time: string;
  readonly existingMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly newMedia?: readonly { readonly filename: string; readonly dataUrl: string }[];
}

interface ExistingEventMediaItem {
  readonly kind: 'existing';
  readonly filename: string;
  readonly url: string;
}

interface NewEventMediaItem {
  readonly kind: 'new';
  readonly uri: string;
  readonly base64: string;
  readonly filename: string;
  readonly mimeType: string;
}

type EventMediaItem = ExistingEventMediaItem | NewEventMediaItem;

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

function Field({
  children,
  label,
  required,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly required?: boolean;
}) {
  return (
    <VStack space="xs">
      <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
        {label}
        {required ? <Text className="text-accent"> *</Text> : null}
      </Text>
      {children}
    </VStack>
  );
}

interface EventComposerProps {
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (draft: EventComposerDraft) => void;
  readonly initialTitle?: string;
  readonly initialPlace?: string;
  readonly initialTag?: string;
  readonly initialStartsAt?: string;
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
  initialMedia,
  initialPlace = '',
  initialStartsAt,
  initialTag = '',
  initialTitle = '',
  isSubmitting,
  onDismiss,
  onSubmit,
  submitLabel = 'Add event',
}: EventComposerProps) {
  const [title, setTitle] = useState(initialTitle);
  const [place, setPlace] = useState(initialPlace);
  const [tag, setTag] = useState<string>(initialTag);
  const [today] = useState(startOfToday);
  const [maxDate] = useState(() => oneYearAfter(today));
  const [date, setDate] = useState(() =>
    initialStartsAt ? new Date(initialStartsAt) : today,
  );
  const [time, setTime] = useState(() =>
    initialStartsAt ? new Date(initialStartsAt) : nextQuarterHour(),
  );
  const [media, setMedia] = useState<readonly EventMediaItem[]>(
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
    place.trim().length > 0 &&
    tag.length > 0 &&
    !isSubmitting;

  const showAlert = (nextTitle: string, message: string) => {
    setAlertTitle(nextTitle);
    setAlertMessage(message);
  };

  const pickImage = async () => {
    const remaining = 10 - media.length;
    if (remaining <= 0) {
      showAlert('Limit reached', 'You can upload up to 10 files per event');
      return;
    }

    const picked = await pickGalleryImages({ selectionLimit: remaining });
    const newMedia: readonly EventMediaItem[] = picked.map((asset) => ({
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
          {submitLabel === 'Add event' ? 'New event at the lake' : 'Edit event'}
        </Text>

        <Field label="What is it?" required>
          <Input size="lg">
            <InputField
              maxLength={100}
              onChangeText={setTitle}
              placeholder="Event name"
              testID="event-title"
              value={title}
            />
          </Input>
        </Field>

        <Field label="Where?" required>
          <Input size="lg">
            <InputField
              maxLength={100}
              onChangeText={setPlace}
              placeholder="Place or venue"
              testID="event-place"
              value={place}
            />
          </Input>
        </Field>

        <Field label="Type" required>
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
            testID="event-cancel"
            variant="link"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-text-muted">
              Cancel
            </ButtonText>
          </Button>
          <Button
            className="rounded-full bg-accent px-5"
            isDisabled={!canSubmit}
            onPress={() =>
              onSubmit({
                date: dateOnlyFromDate(date),
                existingMedia: media
                  .filter((item): item is ExistingEventMediaItem => item.kind === 'existing')
                  .map((item) => ({ filename: item.filename, url: item.url })),
                newMedia: media
                  .filter((item): item is NewEventMediaItem => item.kind === 'new')
                  .map((item) => ({
                    dataUrl: `data:${item.mimeType};base64,${item.base64}`,
                    filename: item.filename,
                  })),
                place: place.trim(),
                tag,
                time: timeOnlyFromDate(time),
                title: title.trim(),
              })
            }
            testID="event-submit"
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

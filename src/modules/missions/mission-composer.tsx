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

import { MISSION_THEME_LABEL, MISSION_THEMES, missionThemeIcon } from './mission-theme';
import type { MissionTheme } from './use-missions';

export interface MissionComposerDraft {
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme | null;
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

const XP_OPTIONS = [25, 50, 75, 100] as const;
const MAX_STOPS = 10;

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
  readonly initialStops?: readonly string[];
  readonly initialTheme?: MissionTheme | null;
  readonly initialMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly submitLabel?: string;
  // See PostComposer's matching prop for why this is needed.
  readonly maxContentHeight?: number;
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
  initialMedia,
  initialScheduledFor,
  initialStops = [],
  initialTheme = null,
  initialTitle = '',
  initialXp = null,
  isSubmitting,
  maxContentHeight,
  onDismiss,
  onSubmit,
  submitLabel = 'Add mission',
}: MissionComposerProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [xp, setXp] = useState<number | null>(initialXp);
  const [stops, setStops] = useState<readonly string[]>(initialStops);
  const [stopDraft, setStopDraft] = useState('');
  const [theme, setTheme] = useState<MissionTheme | null>(initialTheme);
  const [today] = useState(startOfToday);
  const [maxDate] = useState(() => oneYearAfter(today));
  // No date by default -- a mission doesn't need a scheduled day/deadline to
  // be valid; it's an optional detail for ones that are tied to a specific
  // date (see the backend's own `scheduledFor: string | null`, which has
  // always allowed this -- only this form forced a value into it).
  const [scheduledFor, setScheduledFor] = useState<Date | null>(
    () => (initialScheduledFor && dateOnlyToDate(initialScheduledFor)) || null,
  );
  // Collapsed by default -- since a date is optional and most missions won't
  // have one, showing the calendar unconditionally makes every mission look
  // like it needs one. Starts open only when editing a mission that already
  // has a date set.
  const [showDatePicker, setShowDatePicker] = useState(() =>
    Boolean(initialScheduledFor),
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
    stops.length > 0 &&
    !isSubmitting;

  const showAlert = (nextTitle: string, message: string) => {
    setAlertTitle(nextTitle);
    setAlertMessage(message);
  };

  const addStop = () => {
    const trimmed = stopDraft.trim();
    if (!trimmed || stops.length >= MAX_STOPS) {
      return;
    }
    setStops([...stops, trimmed]);
    setStopDraft('');
  };

  const removeStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index));
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
      style={maxContentHeight ? { maxHeight: maxContentHeight } : undefined}
    >
      <VStack className="px-5 pb-2 pt-1" space="lg">
        <Text className="font-inter-bold text-[17px] text-content">
          {submitLabel === 'Add mission' ? 'New mission around the lake' : 'Edit mission'}
        </Text>

        <Field label="Name it">
          <Input size="lg">
            <InputField
              maxLength={100}
              onChangeText={setTitle}
              placeholder="Mission name"
              testID="mission-title"
              value={title}
            />
          </Input>
        </Field>

        <Field label="What to do">
          <VStack space="sm">
            <GrowingTextInput
              className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-content"
              maxHeight={280}
              maxLength={500}
              onChangeText={setDescription}
              placeholder="Describe the challenge"
              testID="mission-description"
              value={description}
            />
            <Text className="text-[12px] text-text-muted">
              Break it into stops — add one for each place or task along the way.
            </Text>
            {stops.length > 0 ? (
              <VStack space="xs">
                {stops.map((stop, index) => (
                  <HStack
                    className="items-center gap-2 rounded-xl bg-secondary px-3 py-2.5"
                    key={`${index}-${stop}`}
                  >
                    <Text className="font-inter-semibold text-[12px] text-text-muted">
                      {index + 1}
                    </Text>
                    <Text className="flex-1 text-[14px] text-content">
                      {stop}
                    </Text>
                    <Pressable
                      accessibilityLabel={`Remove stop ${index + 1}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => removeStop(index)}
                      testID={`mission-stop-remove-${index}`}
                    >
                      <Icon color="rgb(169,156,139)" name="Close" size={16} />
                    </Pressable>
                  </HStack>
                ))}
              </VStack>
            ) : null}
            {stops.length < MAX_STOPS ? (
              <HStack className="items-center gap-2">
                <Input className="flex-1" size="lg">
                  <InputField
                    maxLength={120}
                    onChangeText={setStopDraft}
                    onSubmitEditing={addStop}
                    placeholder="Describe the next stop"
                    testID="mission-stop-input"
                    value={stopDraft}
                  />
                </Input>
                <Pressable
                  accessibilityLabel="Add stop"
                  accessibilityRole="button"
                  className="h-11 w-11 items-center justify-center rounded-full bg-accent"
                  disabled={stopDraft.trim().length === 0}
                  onPress={addStop}
                  style={{ opacity: stopDraft.trim().length === 0 ? 0.5 : 1 }}
                  testID="mission-stop-add"
                >
                  <Icon color="#fff" name="Add" size={18} />
                </Pressable>
              </HStack>
            ) : null}
          </VStack>
        </Field>

        <Field label="Scheduled for (optional)">
          {showDatePicker ? (
            <VStack space="xs">
              <DateCalendar
                maxDate={maxDate}
                minDate={today}
                onChange={setScheduledFor}
                testID="mission-date-calendar"
                value={scheduledFor ?? undefined}
              />
              <Button
                action="secondary"
                className="self-start rounded-full"
                onPress={() => {
                  setScheduledFor(null);
                  setShowDatePicker(false);
                }}
                size="sm"
                testID="mission-date-clear"
                variant="outline"
              >
                <ButtonText className="font-inter-semibold text-[13px]">
                  Clear date
                </ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack space="xs">
              <Text className="text-[12px] text-text-muted">
                Leave unset for an ongoing mission with no fixed day.
              </Text>
              <Button
                action="secondary"
                className="self-start rounded-full"
                onPress={() => setShowDatePicker(true)}
                size="sm"
                testID="mission-date-add"
                variant="outline"
              >
                <Icon color="rgb(169,156,139)" name="Add" size={14} />
                <ButtonText className="font-inter-semibold text-[13px]">
                  Add a deadline
                </ButtonText>
              </Button>
            </VStack>
          )}
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

        <Field label="Theme (optional)">
          <HStack className="flex-wrap gap-2">
            {MISSION_THEMES.map((option) => {
              const active = theme === option;
              return (
                <Pressable
                  accessibilityLabel={MISSION_THEME_LABEL[option]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${active ? 'bg-accent' : 'bg-secondary'}`}
                  key={option}
                  onPress={() => setTheme(active ? null : option)}
                  testID={`mission-theme-${option}`}
                >
                  <Icon
                    color={active ? '#fff' : 'rgb(37,30,23)'}
                    name={missionThemeIcon(option)}
                    size={16}
                  />
                  <Text
                    className={`font-inter-medium text-[13px] ${active ? 'text-accent-foreground' : 'text-content'}`}
                  >
                    {MISSION_THEME_LABEL[option]}
                  </Text>
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
              if (xp === null || stops.length === 0) {
                return;
              }
              onSubmit({
                description: description.trim(),
                existingMedia: media
                  .filter((item): item is ExistingMissionMediaItem => item.kind === 'existing')
                  .map((item) => ({ filename: item.filename, url: item.url })),
                theme,
                newMedia: media
                  .filter((item): item is NewMissionMediaItem => item.kind === 'new')
                  .map((item) => ({
                    dataUrl: `data:${item.mimeType};base64,${item.base64}`,
                    filename: item.filename,
                  })),
                scheduledFor: scheduledFor ? dateOnlyFromDate(scheduledFor) : null,
                stops,
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

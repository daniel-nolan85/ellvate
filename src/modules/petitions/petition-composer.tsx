import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { pickGalleryImages, type PickedImage } from '@/src/platform/media-picker';

import {
  PETITION_CATEGORIES,
  PETITION_DEADLINE_OPTIONS,
  projectedSignatureGoal,
  type CreatePetitionInput,
  type PetitionCategory,
} from './petitions-types';

const MAX_MEDIA = 10;

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

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 1500;

interface PetitionComposerProps {
  readonly isSubmitting: boolean;
  readonly totalUsers: number;
  readonly onDismiss: () => void;
  readonly onSubmit: (draft: CreatePetitionInput) => void;
  // A submission error, shown inline rather than as an outer toast -- this
  // composer renders inside a Sheet's own full-screen Modal, which sits in
  // its own native layer above the rest of the screen, so a toast rendered
  // as a sibling of the Sheet would be completely invisible behind it while
  // the sheet stays open on error.
  readonly errorMessage?: string | null;
  // Bounds this composer's own ScrollView to the Sheet's available content
  // height. See PostComposer's matching prop for why this is required for
  // long-content scrolling to actually work inside a Sheet.
  readonly maxContentHeight?: number;
}

export function PetitionComposer({
  errorMessage,
  isSubmitting,
  maxContentHeight,
  onDismiss,
  onSubmit,
  totalUsers,
}: PetitionComposerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PetitionCategory | null>(null);
  const [deadlineDays, setDeadlineDays] = useState<7 | 14 | 30 | 60 | 90 | null>(null);
  const [agreedToGuidelines, setAgreedToGuidelines] = useState(false);
  const [media, setMedia] = useState<readonly PickedImage[]>([]);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    category !== null &&
    deadlineDays !== null &&
    agreedToGuidelines &&
    !isSubmitting;

  const pickImage = async () => {
    const remaining = MAX_MEDIA - media.length;
    if (remaining <= 0) {
      return;
    }
    const picked = await pickGalleryImages({ selectionLimit: remaining });
    setMedia([...media, ...picked]);
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
      <VStack className="px-5 pb-2 pt-1" space="md">
        <Text className="font-inter-bold text-[17px] text-content">Start a petition</Text>
        <Text className="text-[13px] text-text-muted">
          Once enough neighbors sign, an admin reviews it and shares it with the HOA
          board as a respectful request for consideration — not a demand. It&apos;s a
          way to make sure your voice is heard, not a guarantee the board will act on
          it. The community will be updated here once the petition succeeds, and
          again if the board responds.
        </Text>

        <Text className="text-[13px] text-text-muted" testID="petition-signature-goal">
          Right now this would need{' '}
          <Text className="font-inter-semibold text-[13px] text-content">
            {projectedSignatureGoal(totalUsers)} signatures
          </Text>{' '}
          to succeed — 20% of the community. That number locks in the moment you start the
          petition.
        </Text>

        <Field label="What's the issue?" required>
          <Input size="lg">
            <InputField
              maxLength={MAX_TITLE}
              onChangeText={setTitle}
              placeholder="e.g. Add lighting to the marina walkway"
              testID="petition-title"
              value={title}
            />
          </Input>
        </Field>

        <Field label="Details" required>
          <GrowingTextInput
            className="rounded-2xl border border-line bg-canvas px-4 py-3 text-[15px] text-content"
            maxHeight={280}
            maxLength={MAX_DESCRIPTION}
            minHeight={100}
            onChangeText={setDescription}
            placeholder="Explain the problem and what you'd like to see happen."
            testID="petition-description"
            value={description}
          />
        </Field>

        <Field label="Category" required>
          <HStack className="flex-wrap gap-2">
            {PETITION_CATEGORIES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                onPress={() => setCategory(option.value)}
                selected={category === option.value}
                testID={`petition-category-${option.value}`}
              />
            ))}
          </HStack>
        </Field>

        <Field label="How long should it run?" required>
          <HStack className="flex-wrap gap-2">
            {PETITION_DEADLINE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                onPress={() => setDeadlineDays(option.value)}
                selected={deadlineDays === option.value}
                testID={`petition-deadline-${option.value}`}
              />
            ))}
          </HStack>
        </Field>

        <Field label="Photos">
          {media.length > 0 ? (
            <VStack space="xs">
              <Text className="text-xs text-text-muted">{media.length}/{MAX_MEDIA} files</Text>
              <HStack className="flex-wrap gap-2">
                {media.map((item, index) => (
                  <View
                    key={item.uri}
                    className="relative h-20 w-20 overflow-hidden rounded-lg bg-secondary"
                  >
                    <Image
                      source={{ uri: item.uri }}
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
                {media.length < MAX_MEDIA && (
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

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToGuidelines }}
          className="flex-row items-start gap-2.5"
          onPress={() => setAgreedToGuidelines((current) => !current)}
          testID="petition-guidelines-checkbox"
        >
          <VStack
            className={`h-5 w-5 items-center justify-center rounded-[6px] border ${
              agreedToGuidelines ? 'border-accent bg-accent' : 'border-line bg-canvas'
            }`}
          >
            {agreedToGuidelines ? (
              <Icon color="#ffffff" name="Check" size={13} strokeWidth={3} />
            ) : null}
          </VStack>
          <Text className="flex-1 text-[13px] leading-5 text-text-muted">
            This petition is about the issue, not individuals — I won&apos;t name or
            accuse specific board members or staff.
          </Text>
        </Pressable>

        {errorMessage ? (
          <Text className="text-destructive" size="sm" testID="petition-submit-error">
            {errorMessage}
          </Text>
        ) : null}

        <HStack className="items-center justify-end" space="sm">
          <Button
            action="secondary"
            isDisabled={isSubmitting}
            onPress={onDismiss}
            size="sm"
            testID="petition-cancel"
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
              if (!category || !deadlineDays) {
                return;
              }
              onSubmit({
                category,
                deadlineDays,
                description: description.trim(),
                newMedia: media.map((item) => ({
                  dataUrl: `data:${item.mimeType};base64,${item.base64}`,
                  filename: item.filename,
                })),
                title: title.trim(),
              });
            }}
            size="sm"
            testID="petition-submit"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
              {isSubmitting ? 'Starting…' : 'Start petition'}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>
    </ScrollView>
  );
}

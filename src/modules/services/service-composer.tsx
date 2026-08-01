import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { pickGalleryImages } from '@/src/platform/media-picker';

import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABEL,
  serviceCategoryIcon,
  serviceCategoryIconColor,
} from './service-category';
import type { ServiceCategory } from './use-services';

export interface ServiceComposerDraft {
  readonly businessName: string;
  readonly category: ServiceCategory;
  readonly description: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly contactWebsite: string;
  readonly serviceArea: string;
  readonly hours: string;
  readonly existingLogo?: { readonly filename: string; readonly url: string };
  readonly newLogo?: { readonly filename: string; readonly dataUrl: string };
  readonly existingMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly newMedia?: readonly { readonly filename: string; readonly dataUrl: string }[];
}

interface ExistingServiceMediaItem {
  readonly kind: 'existing';
  readonly filename: string;
  readonly url: string;
}

interface NewServiceMediaItem {
  readonly kind: 'new';
  readonly uri: string;
  readonly base64: string;
  readonly filename: string;
  readonly mimeType: string;
}

type ServiceMediaItem = ExistingServiceMediaItem | NewServiceMediaItem;
type ServiceLogoItem = ExistingServiceMediaItem | NewServiceMediaItem;

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

interface ServiceComposerProps {
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (draft: ServiceComposerDraft) => void;
  readonly initialBusinessName?: string;
  readonly initialCategory?: ServiceCategory | null;
  readonly initialDescription?: string;
  readonly initialContactPhone?: string;
  readonly initialContactEmail?: string;
  readonly initialContactWebsite?: string;
  readonly initialServiceArea?: string;
  readonly initialHours?: string;
  readonly initialLogo?: { readonly filename: string; readonly url: string } | null;
  readonly initialMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly submitLabel?: string;
}

export function ServiceComposer({
  initialBusinessName = '',
  initialCategory = null,
  initialContactEmail = '',
  initialContactPhone = '',
  initialContactWebsite = '',
  initialDescription = '',
  initialHours = '',
  initialLogo = null,
  initialMedia,
  initialServiceArea = '',
  isSubmitting,
  onDismiss,
  onSubmit,
  submitLabel = 'List business',
}: ServiceComposerProps) {
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [category, setCategory] = useState<ServiceCategory | null>(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [contactPhone, setContactPhone] = useState(initialContactPhone);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [contactWebsite, setContactWebsite] = useState(initialContactWebsite);
  const [serviceArea, setServiceArea] = useState(initialServiceArea);
  const [hours, setHours] = useState(initialHours);
  const [logo, setLogo] = useState<ServiceLogoItem | null>(
    () =>
      initialLogo && { filename: initialLogo.filename, kind: 'existing' as const, url: initialLogo.url },
  );
  const [media, setMedia] = useState<readonly ServiceMediaItem[]>(
    () =>
      initialMedia?.map((item) => ({
        filename: item.filename,
        kind: 'existing' as const,
        url: item.url,
      })) ?? [],
  );
  const [alertTitle, setAlertTitle] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const hasContact =
    contactPhone.trim().length > 0 ||
    contactEmail.trim().length > 0 ||
    contactWebsite.trim().length > 0;

  const canSubmit =
    businessName.trim().length > 0 &&
    description.trim().length > 0 &&
    category !== null &&
    hasContact &&
    !isSubmitting;

  const showAlert = (nextTitle: string, message: string) => {
    setAlertTitle(nextTitle);
    setAlertMessage(message);
  };

  const pickImage = async () => {
    const remaining = 10 - media.length;
    if (remaining <= 0) {
      showAlert('Limit reached', 'You can upload up to 10 files per listing');
      return;
    }

    const picked = await pickGalleryImages({ selectionLimit: remaining });
    const newMedia: readonly ServiceMediaItem[] = picked.map((asset) => ({
      ...asset,
      kind: 'new' as const,
    }));
    setMedia([...media, ...newMedia]);
  };

  const removeMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const pickLogo = async () => {
    const picked = await pickGalleryImages({ selectionLimit: 1 });
    const asset = picked[0];
    if (asset) {
      setLogo({ ...asset, kind: 'new' as const });
    }
  };

  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <VStack className="px-5 pb-2 pt-1" space="md">
        <Text className="font-inter-bold text-[17px] text-content">
          {submitLabel === 'List business' ? 'List your business' : 'Edit listing'}
        </Text>

        <Field label="Business name">
          <Input size="lg">
            <InputField
              onChangeText={setBusinessName}
              placeholder="e.g. Lakeside Tails Dog Walking"
              testID="service-business-name"
              value={businessName}
            />
          </Input>
        </Field>

        <Field label="What you do">
          <GrowingTextInput
            className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-content"
            maxHeight={200}
            onChangeText={setDescription}
            placeholder="Describe your service"
            testID="service-description"
            value={description}
          />
        </Field>

        <Field label="Category">
          <HStack className="flex-wrap gap-2">
            {SERVICE_CATEGORIES.map((option) => (
              <Chip
                key={option}
                label={SERVICE_CATEGORY_LABEL[option]}
                onPress={() => setCategory(option)}
                selected={category === option}
                testID={`service-category-${option}`}
              />
            ))}
          </HStack>
        </Field>

        <Field label="Logo">
          <HStack className="items-center gap-3">
            <Pressable
              className="h-16 w-16 items-center justify-center overflow-hidden rounded-[16px] bg-secondary"
              onPress={pickLogo}
              testID="service-logo-picker"
            >
              {logo ? (
                <Image
                  className="h-full w-full"
                  resizeMode="cover"
                  source={{ uri: logo.kind === 'existing' ? logo.url : logo.uri }}
                />
              ) : (
                <Icon
                  color={category ? serviceCategoryIconColor(category) : 'rgb(169,156,139)'}
                  name={category ? serviceCategoryIcon(category) : 'Store'}
                  size={26}
                />
              )}
            </Pressable>
            <VStack className="flex-1 gap-1">
              <Text className="text-[13px] text-text-muted">
                {logo
                  ? 'Shown instead of the category icon.'
                  : 'Optional — without one, a category icon is shown.'}
              </Text>
              {logo ? (
                <Pressable onPress={() => setLogo(null)}>
                  <Text className="font-inter-semibold text-[13px] text-accent">
                    Remove logo
                  </Text>
                </Pressable>
              ) : null}
            </VStack>
          </HStack>
        </Field>

        <Field label="Phone">
          <Input size="lg">
            <InputField
              keyboardType="phone-pad"
              onChangeText={setContactPhone}
              placeholder="(702) 555-0100"
              testID="service-contact-phone"
              value={contactPhone}
            />
          </Input>
        </Field>

        <Field label="Email">
          <Input size="lg">
            <InputField
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setContactEmail}
              placeholder="you@example.com"
              testID="service-contact-email"
              value={contactEmail}
            />
          </Input>
        </Field>

        <Field label="Website">
          <Input size="lg">
            <InputField
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={setContactWebsite}
              placeholder="https://"
              testID="service-contact-website"
              value={contactWebsite}
            />
          </Input>
        </Field>

        <Field label="Service area">
          <Input size="lg">
            <InputField
              onChangeText={setServiceArea}
              placeholder="e.g. Lake Las Vegas"
              testID="service-area"
              value={serviceArea}
            />
          </Input>
        </Field>

        <Field label="Hours">
          <Input size="lg">
            <InputField
              onChangeText={setHours}
              placeholder="e.g. Mon–Fri 8am–6pm"
              testID="service-hours"
              value={hours}
            />
          </Input>
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
            testID="service-cancel"
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
              if (category === null) {
                return;
              }
              onSubmit({
                businessName: businessName.trim(),
                category,
                contactEmail: contactEmail.trim(),
                contactPhone: contactPhone.trim(),
                contactWebsite: contactWebsite.trim(),
                description: description.trim(),
                existingLogo:
                  logo?.kind === 'existing'
                    ? { filename: logo.filename, url: logo.url }
                    : undefined,
                newLogo:
                  logo?.kind === 'new'
                    ? {
                        dataUrl: `data:${logo.mimeType};base64,${logo.base64}`,
                        filename: logo.filename,
                      }
                    : undefined,
                existingMedia: media
                  .filter((item): item is ExistingServiceMediaItem => item.kind === 'existing')
                  .map((item) => ({ filename: item.filename, url: item.url })),
                newMedia: media
                  .filter((item): item is NewServiceMediaItem => item.kind === 'new')
                  .map((item) => ({
                    dataUrl: `data:${item.mimeType};base64,${item.base64}`,
                    filename: item.filename,
                  })),
                serviceArea: serviceArea.trim(),
                hours: hours.trim(),
              });
            }}
            testID="service-submit"
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

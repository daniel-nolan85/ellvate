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
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_LABEL,
  businessCategoryIcon,
  businessCategoryIconColor,
} from './business-category';
import type { BusinessCategory } from './use-businesses';

const MAX_SPECIALS = 5;

export interface BusinessComposerDraft {
  readonly businessName: string;
  readonly category: BusinessCategory;
  readonly description: string;
  readonly contactPhone: string;
  readonly contactEmail: string;
  readonly contactWebsite: string;
  readonly address: string;
  readonly hours: string;
  readonly currentSpecials: readonly string[];
  readonly existingLogo?: { readonly filename: string; readonly url: string };
  readonly newLogo?: { readonly filename: string; readonly dataUrl: string };
  readonly existingMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly newMedia?: readonly { readonly filename: string; readonly dataUrl: string }[];
}

interface ExistingBusinessMediaItem {
  readonly kind: 'existing';
  readonly filename: string;
  readonly url: string;
}

interface NewBusinessMediaItem {
  readonly kind: 'new';
  readonly uri: string;
  readonly base64: string;
  readonly filename: string;
  readonly mimeType: string;
}

type BusinessMediaItem = ExistingBusinessMediaItem | NewBusinessMediaItem;
type BusinessLogoItem = ExistingBusinessMediaItem | NewBusinessMediaItem;

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

interface BusinessComposerProps {
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (draft: BusinessComposerDraft) => void;
  readonly initialBusinessName?: string;
  readonly initialCategory?: BusinessCategory | null;
  readonly initialDescription?: string;
  readonly initialContactPhone?: string;
  readonly initialContactEmail?: string;
  readonly initialContactWebsite?: string;
  readonly initialAddress?: string;
  readonly initialHours?: string;
  readonly initialCurrentSpecials?: readonly string[];
  readonly initialLogo?: { readonly filename: string; readonly url: string } | null;
  readonly initialMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly submitLabel?: string;
  // Bounds this composer's own ScrollView to the Sheet's available content
  // height. See PostComposer's matching prop for why this is required for
  // long-content scrolling to actually work inside a Sheet.
  readonly maxContentHeight?: number;
}

export function BusinessComposer({
  initialAddress = '',
  initialBusinessName = '',
  initialCategory = null,
  initialContactEmail = '',
  initialContactPhone = '',
  initialContactWebsite = '',
  initialCurrentSpecials = [],
  initialDescription = '',
  initialHours = '',
  initialLogo = null,
  initialMedia,
  isSubmitting,
  maxContentHeight,
  onDismiss,
  onSubmit,
  submitLabel = 'List business',
}: BusinessComposerProps) {
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [category, setCategory] = useState<BusinessCategory | null>(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [contactPhone, setContactPhone] = useState(initialContactPhone);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [contactWebsite, setContactWebsite] = useState(initialContactWebsite);
  const [address, setAddress] = useState(initialAddress);
  const [hours, setHours] = useState(initialHours);
  const [specials, setSpecials] = useState<string[]>([...initialCurrentSpecials]);
  const [logo, setLogo] = useState<BusinessLogoItem | null>(
    () =>
      initialLogo && { filename: initialLogo.filename, kind: 'existing' as const, url: initialLogo.url },
  );
  const [media, setMedia] = useState<readonly BusinessMediaItem[]>(
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
    const newMedia: readonly BusinessMediaItem[] = picked.map((asset) => ({
      ...asset,
      kind: 'new' as const,
    }));
    setMedia([...media, ...newMedia]);
  };

  const removeMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const addSpecial = () => {
    if (specials.length >= MAX_SPECIALS) {
      return;
    }
    setSpecials([...specials, '']);
  };

  const updateSpecial = (index: number, text: string) => {
    setSpecials(specials.map((special, i) => (i === index ? text : special)));
  };

  const removeSpecial = (index: number) => {
    setSpecials(specials.filter((_, i) => i !== index));
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
      style={maxContentHeight ? { maxHeight: maxContentHeight } : undefined}
    >
      <VStack className="px-5 pb-2 pt-1" space="md">
        <Text className="font-inter-bold text-[17px] text-content">
          {submitLabel === 'List business' ? 'List your business' : 'Edit listing'}
        </Text>

        <Field label="Business name" required>
          <Input size="lg">
            <InputField
              maxLength={80}
              onChangeText={setBusinessName}
              placeholder="e.g. Marina Sunset Grill"
              testID="business-name"
              value={businessName}
            />
          </Input>
        </Field>

        <Field label="About" required>
          <GrowingTextInput
            className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-content"
            maxHeight={280}
            maxLength={1000}
            onChangeText={setDescription}
            placeholder="Tell neighbors what you offer"
            testID="business-description"
            value={description}
          />
        </Field>

        <Field label="Category" required>
          <HStack className="flex-wrap gap-2">
            {BUSINESS_CATEGORIES.map((option) => (
              <Chip
                key={option}
                label={BUSINESS_CATEGORY_LABEL[option]}
                onPress={() => setCategory(option)}
                selected={category === option}
                testID={`business-category-${option}`}
              />
            ))}
          </HStack>
        </Field>

        <Field label="Logo">
          <HStack className="items-center gap-3">
            <Pressable
              className="h-16 w-16 items-center justify-center overflow-hidden rounded-[16px] bg-secondary"
              onPress={pickLogo}
              testID="business-logo-picker"
            >
              {logo ? (
                <Image
                  className="h-full w-full"
                  resizeMode="cover"
                  source={{ uri: logo.kind === 'existing' ? logo.url : logo.uri }}
                />
              ) : (
                <Icon
                  color={category ? businessCategoryIconColor(category) : 'rgb(169,156,139)'}
                  name={category ? businessCategoryIcon(category) : 'Store'}
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

        <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
          Contact
          <Text className="text-accent"> * (at least one)</Text>
        </Text>

        <Field label="Phone">
          <Input size="lg">
            <InputField
              keyboardType="phone-pad"
              maxLength={120}
              onChangeText={setContactPhone}
              placeholder="(702) 555-0100"
              testID="business-contact-phone"
              value={contactPhone}
            />
          </Input>
        </Field>

        <Field label="Email">
          <Input size="lg">
            <InputField
              autoCapitalize="none"
              keyboardType="email-address"
              maxLength={120}
              onChangeText={setContactEmail}
              placeholder="you@example.com"
              testID="business-contact-email"
              value={contactEmail}
            />
          </Input>
        </Field>

        <Field label="Website">
          <Input size="lg">
            <InputField
              autoCapitalize="none"
              keyboardType="url"
              maxLength={120}
              onChangeText={setContactWebsite}
              placeholder="https://"
              testID="business-contact-website"
              value={contactWebsite}
            />
          </Input>
        </Field>

        <Text className="text-[12px] leading-4 text-text-muted">
          A matching email or website domain lets us verify your listing
          instantly. Otherwise we&apos;ll take a quick look before it goes
          live.
        </Text>

        <Field label="Address">
          <Input size="lg">
            <InputField
              maxLength={120}
              onChangeText={setAddress}
              placeholder="e.g. 10 Marina Way"
              testID="business-address"
              value={address}
            />
          </Input>
        </Field>

        <Field label="Hours">
          <Input size="lg">
            <InputField
              maxLength={120}
              onChangeText={setHours}
              placeholder="e.g. Mon–Sun 11am–10pm"
              testID="business-hours"
              value={hours}
            />
          </Input>
        </Field>

        <Field label="Current specials">
          <VStack space="xs">
            {specials.length > 0 ? (
              <VStack space="xs">
                {specials.map((special, index) => (
                  <HStack className="items-center gap-2" key={index}>
                    <Input className="flex-1" size="lg">
                      <InputField
                        maxLength={200}
                        onChangeText={(text) => updateSpecial(index, text)}
                        placeholder="e.g. Half-off appetizers, 4–6pm daily"
                        testID={`business-special-${index}`}
                        value={special}
                      />
                    </Input>
                    <Pressable
                      accessibilityLabel={`Remove special ${index + 1}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => removeSpecial(index)}
                      testID={`business-special-remove-${index}`}
                    >
                      <Icon color="rgb(169,156,139)" name="Close" size={16} />
                    </Pressable>
                  </HStack>
                ))}
              </VStack>
            ) : null}
            {specials.length < MAX_SPECIALS ? (
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-secondary px-3 py-3"
                onPress={addSpecial}
                testID="business-special-add"
              >
                <Icon color="rgb(169,156,139)" name="Add" size={16} />
                <Text className="font-inter-medium text-[13px] text-text-muted">
                  Add another special
                </Text>
              </Pressable>
            ) : null}
          </VStack>
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

        <Text className="text-[12px] leading-4 text-text-muted">
          Once live, neighbors can rate and review your listing, and report
          it if something seems off. Listings that misrepresent a business,
          or accounts that abuse the listing or review system, may be
          removed and reported.
        </Text>

        <HStack className="items-center justify-end" space="sm">
          <Button
            action="secondary"
            isDisabled={isSubmitting}
            onPress={onDismiss}
            size="sm"
            testID="business-cancel"
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
                address: address.trim(),
                businessName: businessName.trim(),
                category,
                contactEmail: contactEmail.trim(),
                contactPhone: contactPhone.trim(),
                contactWebsite: contactWebsite.trim(),
                currentSpecials: specials.map((special) => special.trim()).filter(Boolean),
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
                  .filter((item): item is ExistingBusinessMediaItem => item.kind === 'existing')
                  .map((item) => ({ filename: item.filename, url: item.url })),
                newMedia: media
                  .filter((item): item is NewBusinessMediaItem => item.kind === 'new')
                  .map((item) => ({
                    dataUrl: `data:${item.mimeType};base64,${item.base64}`,
                    filename: item.filename,
                  })),
                hours: hours.trim(),
              });
            }}
            testID="business-submit"
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

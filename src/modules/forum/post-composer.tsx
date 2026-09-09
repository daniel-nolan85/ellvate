import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CATEGORY_CHIP_ACTIVE_TREATMENT, categoryAccent } from '@/src/lib/category-accent';
import { pickGalleryImages } from '@/src/platform/media-picker';

export interface PostComposerDraft {
  readonly title: string;
  readonly excerpt: string;
  readonly forum?: string;
  readonly existingMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly newMedia?: readonly { readonly filename: string; readonly dataUrl: string }[];
}

interface ExistingMediaItem {
  readonly kind: 'existing';
  readonly filename: string;
  readonly url: string;
}

interface NewMediaItem {
  readonly kind: 'new';
  readonly uri: string;
  readonly base64: string;
  readonly filename: string;
  readonly mimeType: string;
}

type MediaItem = ExistingMediaItem | NewMediaItem;

interface PostComposerProps {
  readonly forum: string;
  readonly subforums: readonly string[];
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (draft: PostComposerDraft) => void;
  readonly initialTitle?: string;
  readonly initialExcerpt?: string;
  readonly initialMedia?: readonly { readonly filename: string; readonly url: string }[];
  readonly submitLabel?: string;
}

export function PostComposer({
  forum: initialForum,
  initialExcerpt = '',
  initialMedia,
  initialTitle = '',
  isSubmitting,
  onDismiss,
  onSubmit,
  subforums,
  submitLabel = 'Post',
}: PostComposerProps) {
  const [title, setTitle] = useState(initialTitle);
  const [excerpt, setExcerpt] = useState(initialExcerpt);
  const [forum, setForum] = useState(initialForum);
  const [media, setMedia] = useState<readonly MediaItem[]>(
    () =>
      initialMedia?.map((item) => ({
        filename: item.filename,
        kind: 'existing' as const,
        url: item.url,
      })) ?? [],
  );
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [alertTitle, setAlertTitle] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 && excerpt.trim().length > 0 && !isSubmitting;

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
  };

  const pickImage = async () => {
    const remaining = 10 - media.length;
    if (remaining <= 0) {
      showAlert('Limit reached', 'You can upload up to 10 files per post');
      return;
    }

    const picked = await pickGalleryImages({ selectionLimit: remaining });
    const newMedia: readonly MediaItem[] = picked.map((asset) => ({
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
      keyboardDismissMode='on-drag'
      keyboardShouldPersistTaps='handled'
      showsVerticalScrollIndicator={false}
    >
      <VStack className='px-5 pb-2 pt-1' space='md'>
        <Text className='font-inter-bold text-[17px] text-content'>
          {submitLabel === 'Post' ? 'New post' : 'Edit post'}
        </Text>

        {/* Forum selector - horizontal scroll */}
        <View className='gap-1'>
          <Text className='text-xs text-text-muted'>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {subforums.map((f) => {
              const isActive = forum === f;
              const treatment = CATEGORY_CHIP_ACTIVE_TREATMENT[categoryAccent(f)];
              return (
                <Pressable
                  key={f}
                  className={`rounded-full px-4 py-2 ${
                    isActive ? treatment.bg : 'bg-secondary'
                  }`}
                  onPress={() => setForum(f)}
                >
                  <Text
                    className={`text-[13px] font-inter-semibold ${
                      isActive ? treatment.text : 'text-content'
                    }`}
                  >
                    {f}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Input size='lg'>
          <InputField
            autoFocus
            maxLength={140}
            onChangeText={setTitle}
            placeholder='Title'
            testID='forum-post-title'
            value={title}
          />
        </Input>

        <GrowingTextInput
          className='w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-base text-content'
          maxHeight={400}
          maxLength={2000}
          onChangeText={setExcerpt}
          placeholder='What do you want to share?'
          testID='forum-post-body'
          value={excerpt}
        />

        {/* Media preview grid */}
        {media.length > 0 && (
          <View className='gap-2'>
            <Text className='text-xs text-text-muted'>
              {media.length}/10 files
            </Text>
            <View className='flex-row flex-wrap gap-2'>
              {media.map((item, index) => (
                <View
                  key={item.kind === 'existing' ? item.url : item.uri}
                  className='relative h-20 w-20 overflow-hidden rounded-lg bg-secondary'
                >
                  <Image
                    source={{ uri: item.kind === 'existing' ? item.url : item.uri }}
                    className='h-full w-full'
                    resizeMode='cover'
                  />
                  <Pressable
                    className='absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500'
                    onPress={() => removeMedia(index)}
                  >
                    <Icon color='white' name='Close' size={14} />
                  </Pressable>
                </View>
              ))}
              {media.length < 10 && (
                <Pressable
                  className='flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-line bg-secondary'
                  onPress={pickImage}
                >
                  <Icon color='rgb(169,156,139)' name='Add' size={20} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Add media button when no media */}
        {media.length === 0 && (
          <Pressable
            className='flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-secondary px-3 py-3'
            onPress={pickImage}
          >
            <Icon color='rgb(169,156,139)' name='Image' size={20} />
          </Pressable>
        )}

        <HStack className='items-center border-t border-line pt-3' space='sm'>
          <Button
            action='secondary'
            isDisabled={isSubmitting}
            onPress={onDismiss}
            size='sm'
            variant='link'
          >
            <ButtonText className='font-inter-semibold text-[13px] text-text-muted'>
              Cancel
            </ButtonText>
          </Button>
          <View className='flex-1' />
          <Button
            className='rounded-full bg-accent px-4'
            isDisabled={!canSubmit}
            onPress={() =>
              onSubmit({
                excerpt: excerpt.trim(),
                existingMedia: media
                  .filter((item): item is ExistingMediaItem => item.kind === 'existing')
                  .map((item) => ({ filename: item.filename, url: item.url })),
                forum,
                newMedia: media
                  .filter((item): item is NewMediaItem => item.kind === 'new')
                  .map((item) => ({
                    dataUrl: `data:${item.mimeType};base64,${item.base64}`,
                    filename: item.filename,
                  })),
                title: title.trim(),
              })
            }
            testID='forum-submit-post'
            size='sm'
          >
            <ButtonText className='font-inter-semibold text-[13px] text-accent-foreground'>
              {submitLabel}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>

      {/* Alert Modal */}
      <Modal
        animationType='fade'
        onRequestClose={() => setAlertTitle(null)}
        transparent
        visible={!!alertTitle}
      >
        <Pressable
          className='flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8'
          onPress={() => setAlertTitle(null)}
        >
          <Pressable
            className='w-full gap-3 rounded-[20px] bg-paper p-5'
            onPress={(event) => event.stopPropagation()}
          >
            <Text className='font-inter-bold text-[17px] text-content'>
              {alertTitle}
            </Text>
            <Text className='text-text-muted' size='sm'>
              {alertMessage}
            </Text>
            <HStack className='justify-end'>
              <Pressable onPress={() => setAlertTitle(null)}>
                <Text className='font-inter-semibold text-[15px] text-accent'>
                  OK
                </Text>
              </Pressable>
            </HStack>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Preview Modal */}
      {previewUri && (
        <Modal transparent visible={!!previewUri}>
          <Pressable
            className='flex-1 items-center justify-center bg-[rgba(0,0,0,0.8)]'
            onPress={() => setPreviewUri(null)}
          >
            <Image
              source={{ uri: previewUri }}
              className='h-3/4 w-full'
              resizeMode='contain'
            />
          </Pressable>
        </Modal>
      )}
    </ScrollView>
  );
}

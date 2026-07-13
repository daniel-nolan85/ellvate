import { useState } from 'react';

import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Input } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

interface PostComposerDraft {
  readonly title: string;
  readonly excerpt: string;
}

interface PostComposerProps {
  readonly forum: string;
  readonly isSubmitting: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (draft: PostComposerDraft) => void;
}

export function PostComposer({
  forum,
  isSubmitting,
  onDismiss,
  onSubmit,
}: PostComposerProps) {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const canSubmit =
    title.trim().length > 0 && excerpt.trim().length > 0 && !isSubmitting;

  return (
    <VStack
      className="mx-5 rounded-[20px] border border-line bg-canvas p-[18px]"
      space="sm"
    >
      <Text className="font-inter-semibold text-[13px] text-text-muted">
        New post in {forum}
      </Text>
      <Input
        autoFocus
        onChangeText={setTitle}
        placeholder="Title"
        size="lg"
        value={title}
      />
      <Input
        onChangeText={setExcerpt}
        placeholder="What do you want to share?"
        size="lg"
        value={excerpt}
      />
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
          className="rounded-full bg-primary px-4"
          isDisabled={!canSubmit}
          onPress={() =>
            onSubmit({ excerpt: excerpt.trim(), title: title.trim() })
          }
          size="sm"
        >
          <ButtonText className="font-inter-semibold text-[13px] text-primary-foreground">
            Post
          </ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}

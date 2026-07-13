import { useState } from 'react';

import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Input, InputField } from '@/src/components/ui/input';
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
    <VStack className="px-5 pb-2 pt-1" space="sm">
      <Text className="font-inter-bold text-[17px] text-content">
        New post in {forum}
      </Text>
      <Input size="lg">
        <InputField
          autoFocus
          onChangeText={setTitle}
          placeholder="Title"
          testID="forum-post-title"
          value={title}
        />
      </Input>
      <Input size="lg">
        <InputField
          onChangeText={setExcerpt}
          placeholder="What do you want to share?"
          testID="forum-post-body"
          value={excerpt}
        />
      </Input>
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
          testID="forum-submit-post"
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

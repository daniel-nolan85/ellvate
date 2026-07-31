import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

const COLOR_STAR = 'rgb(217,123,41)';
const COLOR_MUTED_STAR = 'rgb(214,206,196)';

interface ServiceReviewComposerProps {
  readonly isSubmitting: boolean;
  readonly onSubmit: (input: { readonly rating: 1 | 2 | 3 | 4 | 5; readonly body: string }) => void;
  readonly initialRating?: 1 | 2 | 3 | 4 | 5;
  readonly initialBody?: string | null;
  readonly onCancel?: () => void;
  readonly submitLabel?: string;
  readonly title?: string;
}

export function ServiceReviewComposer({
  initialBody,
  initialRating,
  isSubmitting,
  onCancel,
  onSubmit,
  submitLabel,
  title = 'Write a review',
}: ServiceReviewComposerProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(
    initialRating ?? null,
  );
  const [body, setBody] = useState(initialBody ?? '');

  // A rating alone is a complete review — the body is optional.
  const canSubmit = rating !== null && !isSubmitting;
  const isEditing = onCancel !== undefined;
  const hasBody = body.trim().length > 0;

  // WHY: fields are NOT cleared here on submit — clearing before the mutation
  // resolves would wipe the user's text even if the request fails. Instead the
  // parent forces a remount (via a changing `key` prop) once the create
  // mutation actually succeeds, which resets this component's state fresh.

  return (
    <VStack className="gap-2.5 rounded-[16px] border border-surface-hairline bg-paper p-3.5" space="xs">
      <Text className="font-inter-semibold text-[13px] text-content">
        {title}
      </Text>
      <HStack className="gap-1" testID="service-review-rating">
        {([1, 2, 3, 4, 5] as const).map((value) => (
          <Pressable
            accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: rating !== null && value <= rating }}
            hitSlop={4}
            key={value}
            onPress={() => setRating(value)}
            testID={`service-review-star-${value}`}
          >
            <Icon
              color={rating !== null && value <= rating ? COLOR_STAR : COLOR_MUTED_STAR}
              fill={rating !== null && value <= rating ? COLOR_STAR : 'none'}
              name="Star"
              size={22}
            />
          </Pressable>
        ))}
      </HStack>
      <Input size="lg">
        <InputField
          onChangeText={setBody}
          placeholder="How was it? (optional)"
          testID="service-review-body"
          value={body}
        />
      </Input>
      <HStack className="items-center gap-3">
        <Button
          className="self-start rounded-full bg-accent px-4"
          isDisabled={!canSubmit}
          onPress={() => {
            if (rating === null) {
              return;
            }
            onSubmit({ body: body.trim(), rating });
          }}
          size="sm"
          testID="service-review-submit"
        >
          <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
            {isSubmitting
              ? isEditing
                ? 'Saving…'
                : hasBody
                  ? 'Posting review…'
                  : 'Posting rating…'
              : (submitLabel ?? (hasBody ? 'Post review' : 'Post rating'))}
          </ButtonText>
        </Button>
        {onCancel ? (
          <Pressable onPress={onCancel}>
            <Text className="font-inter-semibold text-[13px] text-text-muted">
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </HStack>
    </VStack>
  );
}

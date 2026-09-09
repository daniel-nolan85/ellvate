import { useState } from 'react';
import { Pressable } from 'react-native';

import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';

interface ComposerProps {
  readonly isSending: boolean;
  readonly onSend: (text: string) => void;
}

export function Composer({ isSending, onSend }: ComposerProps) {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0 && !isSending;

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(value.trim());
    setValue('');
  };

  return (
    <HStack className="items-end gap-2 px-5 pb-7 pt-2.5">
      <GrowingTextInput
        className="flex-1 rounded-[22px] border border-line bg-canvas px-4 py-2.5 text-[14px] text-content"
        maxHeight={120}
        maxLength={2000}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder="Ask about events, posts, missions…"
        submitOnEnter
        testID="assistant-composer-input"
        value={value}
      />
      <Pressable
        accessibilityLabel="Send"
        className={`h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent ${
          canSend ? '' : 'opacity-40'
        }`}
        disabled={!canSend}
        onPress={submit}
      >
        <Icon color="#fff" name="ArrowUp" size={18} />
      </Pressable>
    </HStack>
  );
}

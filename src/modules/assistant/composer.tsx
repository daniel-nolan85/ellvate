import { useState } from 'react';
import { Pressable } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Input } from '@/src/components/ui/input';

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
    <HStack className="items-center gap-2 px-5 pb-7 pt-2.5">
      <Input
        className="flex-1"
        onChangeText={setValue}
        onSubmitEditing={submit}
        pill
        placeholder="Ask about events, posts, missions…"
        returnKeyType="send"
        size="lg"
        submitBehavior="submit"
        value={value}
      />
      <Pressable
        accessibilityLabel="Send"
        className={`h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary ${
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

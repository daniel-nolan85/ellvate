import { useRef } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/src/components/ui/text';

const LENGTH = 6;

interface CodeInputProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly onComplete: (code: string) => void;
  readonly invalid?: boolean;
  readonly autoFocus?: boolean;
  readonly testID?: string;
}

// One-time code entry: six single-digit cells backed by one hidden field. The
// numeric keyboard opens on its own, the next empty cell is highlighted, typing
// advances automatically, and entering the sixth digit submits. On a wrong code
// the parent clears the value and the field stays focused for an immediate retry.
export function CodeInput({
  value,
  onChangeText,
  onComplete,
  invalid = false,
  autoFocus = true,
  testID,
}: CodeInputProps) {
  const ref = useRef<TextInput>(null);

  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, LENGTH);
    onChangeText(next);
    if (next.length === LENGTH) {
      onComplete(next);
    }
  };

  return (
    <View
      accessibilityLabel="Verification code"
      className="relative"
      onTouchStart={() => ref.current?.focus()}
      testID={testID}
    >
      <View className="flex-row justify-between">
        {Array.from({ length: LENGTH }).map((_, index) => {
          const char = value[index] ?? '';
          const active = index === value.length;
          const borderClass = invalid
            ? 'border-2 border-destructive'
            : active
              ? 'border-2 border-content'
              : 'border border-line';
          return (
            <View
              className={`h-[58px] w-[48px] items-center justify-center rounded-2xl ${borderClass} ${char ? 'bg-secondary' : 'bg-canvas'}`}
              key={index}
            >
              <Text className="font-inter-bold text-[24px] text-content">
                {char}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        caretHidden
        className="absolute inset-0 opacity-0"
        keyboardType="number-pad"
        maxLength={LENGTH}
        onChangeText={handleChange}
        ref={ref}
        textContentType="oneTimeCode"
        value={value}
      />
    </View>
  );
}

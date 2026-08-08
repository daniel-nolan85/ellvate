import type { ReactNode } from 'react';

import { View } from 'react-native';

import { Input, InputField } from '@/src/components/ui/input';

import { ObCta, ObTitle } from './chrome';

interface NameStepProps {
  readonly value: string;
  readonly onChange: (name: string) => void;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
}

export function NameStep({ value, onChange, onNext, chrome }: NameStepProps) {
  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <ObTitle
        eyebrow="About you"
        sub="Shown on your posts, comments, and profile so neighbours know who they're talking to. You can change this anytime."
        title="What should we call you?"
      />
      <View className="px-5 py-3.5">
        <Input size="lg">
          <InputField
            autoFocus
            onChangeText={onChange}
            onSubmitEditing={onNext}
            placeholder="First name"
            testID="onboarding-name-input"
            value={value}
          />
        </Input>
      </View>
      <ObCta disabled={value.trim().length === 0} label="Continue" onPress={onNext} />
      <View className="h-[26px]" />
    </View>
  );
}

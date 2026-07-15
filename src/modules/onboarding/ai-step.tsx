import React, { type ReactNode } from 'react';

import { Pressable, View } from 'react-native';

import { AiMark } from '@/src/components/ui/ai-mark';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { ObCta, ObTitle } from './chrome';
import type { AiComfortLevel } from './use-onboarding-state';

const INDIGO = 'rgb(99,102,241)';
const TEXT_MUTED = 'rgb(113,113,123)';

interface AiLevel {
  readonly id: AiComfortLevel;
  readonly icon: AppIconName;
  readonly title: string;
  readonly sub: string;
}

const AI_LEVELS: readonly AiLevel[] = [
  {
    icon: 'HelpCircle',
    id: 'new',
    sub: 'The assistant introduces itself and explains as it goes',
    title: 'New to AI',
  },
  {
    icon: 'MessageCircle',
    id: 'casual',
    sub: 'Suggestions when helpful, out of the way otherwise',
    title: 'I use it sometimes',
  },
  {
    icon: 'Play',
    id: 'power',
    sub: 'Full tool access, terse answers, no hand-holding',
    title: 'Power user',
  },
];

interface AiStepProps {
  readonly value: AiComfortLevel | null;
  readonly onPick: (value: AiComfortLevel) => void;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
}

export function AiStep({ chrome, onNext, onPick, value }: AiStepProps) {
  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <ObTitle
        eyebrow="Lake Assistant"
        sub="It can search events, forum posts and missions for you. How much help do you want?"
        title="Meet your AI concierge"
      />
      <View className="mx-5 mt-3.5 flex-row items-center gap-3 rounded-[18px] bg-primary p-3.5">
        <View className="h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-[rgba(250,250,250,0.12)]">
          <AiMark color={INDIGO} size={18} />
        </View>
        <Text className="flex-1 font-sans text-[13px] leading-[19px] text-[rgba(250,250,250,0.85)]">
          &quot;Any networking events this weekend?&quot; — ask me things like that,
          anytime.
        </Text>
      </View>
      <View className="gap-2.5 px-5 py-4">
        {AI_LEVELS.map((level) => {
          const selected = value === level.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-3.5 rounded-[18px] px-4 py-3.5 ${
                selected
                  ? 'border-[1.5px] border-indigo bg-indigo-subtle'
                  : 'border border-line bg-canvas'
              }`}
              key={level.id}
              onPress={() => onPick(level.id)}
              testID={`onboarding-ai-${level.id}`}
            >
              <Icon
                color={selected ? INDIGO : TEXT_MUTED}
                name={level.icon}
                size={18}
              />
              <View className="flex-1">
                <Text
                  className={`font-inter-semibold text-[14px] ${
                    selected ? 'text-indigo' : 'text-content'
                  }`}
                >
                  {level.title}
                </Text>
                <Text className="mt-0.5 font-sans text-[12px] text-text-muted">
                  {level.sub}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <ObCta disabled={!value} label="Continue" onPress={onNext} />
      <View className="h-[26px]" />
    </View>
  );
}

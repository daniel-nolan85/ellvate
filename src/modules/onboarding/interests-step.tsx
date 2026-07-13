import type { ReactNode } from 'react';

import { Pressable, View } from 'react-native';

import { Text } from '@/src/components/ui/text';

import { ObCta, ObTitle } from './chrome';

export const INTERESTS: readonly string[] = [
  'Boating & marina',
  'Trails & fitness',
  'Dining out',
  'Live events',
  'Family things',
  'Buy & sell',
  'Golf',
  'Paddle sports',
  'Photography',
  'Book club',
  'Wine & tastings',
  'Volunteering',
];

const MIN_PICKS = 3;
const MAX_PICKS = 5;

interface InterestsStepProps {
  readonly picks: readonly string[];
  readonly onToggle: (interest: string) => void;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
}

export function InterestsStep({ picks, onToggle, onNext, chrome }: InterestsStepProps) {
  const handleToggle = (interest: string) => {
    const selected = picks.includes(interest);
    if (!selected && picks.length >= MAX_PICKS) {
      return;
    }
    onToggle(interest);
  };

  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <ObTitle
        eyebrow="Your feed"
        sub="This seeds your forum feed and event picks — like choosing your first three artists on a music app."
        title="Pick 3 or more interests"
      />
      <View className="flex-1 flex-row flex-wrap content-start gap-2 px-5 py-4">
        {INTERESTS.map((interest) => {
          const selected = picks.includes(interest);
          return (
            <Pressable
              accessibilityRole="button"
              className={`rounded-full px-4 py-2.5 ${
                selected
                  ? 'bg-primary shadow-[0px_4px_12px_rgba(23,23,23,0.18)]'
                  : 'bg-secondary'
              }`}
              key={interest}
              onPress={() => handleToggle(interest)}
            >
              <Text
                className={`font-inter-medium text-[13px] ${
                  selected ? 'text-primary-foreground' : 'text-content'
                }`}
              >
                {interest}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-center text-muted-foreground" size="xs">
        {picks.length}/3 minimum
      </Text>
      <ObCta
        disabled={picks.length < MIN_PICKS}
        label={picks.length >= MIN_PICKS ? 'Continue' : `Pick ${MIN_PICKS - picks.length} more`}
        onPress={onNext}
      />
      <View className="h-[26px]" />
    </View>
  );
}

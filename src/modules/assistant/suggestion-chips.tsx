import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/src/components/ui/text';

interface SuggestionChipsProps {
  readonly suggestions: readonly string[];
  readonly onSelect: (text: string) => void;
}

export function SuggestionChips({ onSelect, suggestions }: SuggestionChipsProps) {
  return (
    <ScrollView
      className="grow-0"
      contentContainerClassName="gap-2 px-5 pb-2"
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {suggestions.map((suggestion) => (
        <Pressable
          accessibilityRole="button"
          className="shrink-0 rounded-full bg-indigo-subtle px-3.5 py-2"
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          testID={`assistant-suggestion-${suggestion.toLowerCase().replaceAll(' ', '-')}`}
        >
          <Text className="font-inter-medium text-[12px] text-indigo">
            {suggestion}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

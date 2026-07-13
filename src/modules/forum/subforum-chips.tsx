import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/src/components/ui/text';

interface SubforumChipsProps {
  readonly active: string;
  readonly onSelect: (forum: string) => void;
  readonly subforums: readonly string[];
}

export function SubforumChips({
  active,
  onSelect,
  subforums,
}: SubforumChipsProps) {
  return (
    <ScrollView
      contentContainerStyle={{
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 2,
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {subforums.map((forum) => {
        const isActive = forum === active;

        return (
          <Pressable
            className={`shrink-0 rounded-full px-3.5 py-[7px] ${
              isActive ? 'bg-primary' : 'bg-secondary'
            }`}
            key={forum}
            onPress={() => onSelect(forum)}
          >
            <Text
              className={`font-inter-medium text-[13px] leading-[18px] ${
                isActive
                  ? 'text-primary-foreground'
                  : 'text-secondary-foreground'
              }`}
            >
              {forum}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

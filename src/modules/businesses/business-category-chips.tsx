import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { CATEGORY_CHIP_ACTIVE_TREATMENT } from '@/src/lib/category-accent';

import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_LABEL,
  businessCategoryAccent,
} from './business-category';
import type { BusinessCategory } from './use-businesses';

export type BusinessCategoryFilter = 'all' | BusinessCategory;

interface BusinessCategoryChipsProps {
  readonly active: BusinessCategoryFilter;
  readonly onSelect: (category: BusinessCategoryFilter) => void;
}

export function BusinessCategoryChips({
  active,
  onSelect,
}: BusinessCategoryChipsProps) {
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
      <CategoryChip
        active={active === 'all'}
        label="All"
        onPress={() => onSelect('all')}
        treatment={CATEGORY_CHIP_ACTIVE_TREATMENT.plum}
      />
      {BUSINESS_CATEGORIES.map((category) => (
        <CategoryChip
          active={active === category}
          key={category}
          label={BUSINESS_CATEGORY_LABEL[category]}
          onPress={() => onSelect(category)}
          treatment={CATEGORY_CHIP_ACTIVE_TREATMENT[businessCategoryAccent(category)]}
        />
      ))}
    </ScrollView>
  );
}

interface CategoryChipProps {
  readonly active: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly treatment: { readonly bg: string; readonly text: string };
}

function CategoryChip({ active, label, onPress, treatment }: CategoryChipProps) {
  return (
    <Pressable
      className={`shrink-0 rounded-full px-3.5 py-[7px] ${
        active ? treatment.bg : 'bg-secondary'
      }`}
      onPress={onPress}
    >
      <Text
        className={`font-inter-medium text-[13px] leading-[18px] ${
          active ? treatment.text : 'text-secondary-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

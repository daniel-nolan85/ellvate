import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';
import { BusinessesScreen } from '@/src/modules/businesses';
import { ServicesScreen } from '@/src/modules/services';

type DirectorySection = 'services' | 'businesses';

const SECTIONS: readonly { readonly key: DirectorySection; readonly label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'businesses', label: 'Businesses' },
];

// Mirrors points-history-screen.tsx's TabSwitcher: an equal-width pill row,
// active pill filled with the accent color, rendered right after
// ScreenTitle -- same ordering points-history-screen.tsx itself uses (title
// row, then the switcher). Passed into whichever section is active as
// `headerExtra` so it renders below that section's own avatar/search/bell
// icon row instead of above the whole screen.
function SectionSwitcher({
  active,
  onSelect,
}: {
  readonly active: DirectorySection;
  readonly onSelect: (section: DirectorySection) => void;
}) {
  return (
    <HStack className="px-5 pb-1 pt-2" collapsable={false} space="sm">
      {SECTIONS.map((section) => {
        const isActive = section.key === active;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            className={`flex-1 items-center rounded-full py-2.5 ${
              isActive ? 'bg-accent' : 'bg-secondary'
            }`}
            key={section.key}
            onPress={() => onSelect(section.key)}
            testID={`directory-section-${section.key}`}
          >
            <Text
              className={`font-inter-semibold text-[13px] ${
                isActive ? 'text-accent-foreground' : 'text-secondary-foreground'
              }`}
            >
              {section.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}

interface DirectoryScreenProps {
  readonly onOpenService?: (listingId: string) => void;
  readonly onOpenBusiness?: (listingId: string) => void;
}

export function DirectoryScreen({
  onOpenBusiness,
  onOpenService,
}: DirectoryScreenProps = {}) {
  // Each section already owns its own category-filter state internally
  // (ServicesScreen/BusinessesScreen), so switching this top-level pill
  // never resets or shares either section's filter -- picking a section
  // simply mounts/unmounts its screen component.
  const [section, setSection] = useState<DirectorySection>('services');

  const switcher = <SectionSwitcher active={section} onSelect={setSection} />;

  return (
    <View className="flex-1 bg-canvas">
      {section === 'services' ? (
        <ServicesScreen headerExtra={switcher} onOpenListing={onOpenService} />
      ) : (
        <BusinessesScreen headerExtra={switcher} onOpenListing={onOpenBusiness} />
      )}
    </View>
  );
}

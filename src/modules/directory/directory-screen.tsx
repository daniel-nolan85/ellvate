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
// active pill filled with the accent color. Sits above whichever section's
// screen is active -- each section keeps rendering its own ScreenTitle and
// category-filter chips completely unchanged, so this switcher is purely an
// additional top-level layer, not a replacement for either section's header.
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

  return (
    <View className="flex-1 bg-canvas">
      <SectionSwitcher active={section} onSelect={setSection} />
      {section === 'services' ? (
        <ServicesScreen onOpenListing={onOpenService} />
      ) : (
        <BusinessesScreen onOpenListing={onOpenBusiness} />
      )}
    </View>
  );
}

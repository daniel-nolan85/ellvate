import { Pressable, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

export type CommunityTabId = 'forum' | 'events' | 'missions' | 'directory' | 'petitions';

interface FloatingTabBarProps {
  readonly activeTab: CommunityTabId | null;
  readonly onTabPress: (id: CommunityTabId) => void;
}

interface TabDefinition {
  readonly id: CommunityTabId;
  readonly label: string;
  readonly icon: AppIconName;
}

const TABS: readonly TabDefinition[] = [
  { id: 'forum', label: 'Forum', icon: 'MessageCircle' },
  { id: 'events', label: 'Events', icon: 'CalendarDays' },
  { id: 'missions', label: 'Missions', icon: 'Star' },
  { id: 'directory', label: 'Directory', icon: 'Store' },
  { id: 'petitions', label: 'Petitions', icon: 'FileSignature' },
];

const ACTIVE_COLOR = '#ffffff';
const INACTIVE_COLOR = 'rgba(250,250,250,0.45)';

// This bar's own height -- kept as a named export so anything positioning
// itself relative to the bar (AssistantButton in app/_layout.tsx, every
// scrollable screen's own bottom clearance) has one source of truth instead
// of a second copy of this number.
export const FLOATING_TAB_BAR_HEIGHT = 68;

// Mirrors this bar's own `bottom` position (Math.max(20, insets.bottom + 8)
// -- see the style prop below) plus its height plus `extraGap` of breathing
// room above it. Every scrollable screen under the floating tab bar/
// AssistantButton (both float above "every protected screen, tabs and
// non-tab alike" -- see app/_layout.tsx) used to pad its content with a
// flat `paddingBottom: 130`, tuned for iOS's typical ~34px bottom inset.
// Android's own inset varies by nav mode (gesture vs. 3-button) and is
// often smaller, so a flat constant either under- or over-clears the bar
// depending on the device -- this computes the real clearance for whatever
// device it's actually running on, the same way AssistantButton's own
// position already does.
export function useFloatingContentClearance(extraGap = 16): number {
  const insets = useSafeAreaInsets();
  return Math.max(20, insets.bottom + 8) + FLOATING_TAB_BAR_HEIGHT + extraGap;
}

const barShadow: ViewStyle = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.28,
  shadowRadius: 16,
  elevation: 12,
};

interface TabItemProps {
  readonly tab: TabDefinition;
  readonly isActive: boolean;
  readonly onPress: () => void;
}

function TabItem({ tab, isActive, onPress }: TabItemProps) {
  const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      className="flex-1 flex-col items-center gap-[3px] py-2"
      onPress={onPress}
      testID={`tab-${tab.label.toLowerCase()}`}
    >
      <Icon color={color} name={tab.icon} size={21} />
      <Text
        className={
          isActive
            ? 'font-inter-semibold text-[10px] text-[#ffffff]'
            : 'font-inter-medium text-[10px] text-[rgba(250,250,250,0.45)]'
        }
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function FloatingTabBar({ activeTab, onTabPress }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute left-4 right-4 z-10 h-[68px] flex-row items-center rounded-full bg-[rgba(23,23,23,0.96)] px-2.5"
      style={[barShadow, { bottom: Math.max(20, insets.bottom + 8) }]}
    >
      {TABS.map((tab) => (
        <TabItem
          isActive={activeTab === tab.id}
          key={tab.id}
          onPress={() => onTabPress(tab.id)}
          tab={tab}
        />
      ))}
    </View>
  );
}

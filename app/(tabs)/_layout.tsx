import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabBar, type CommunityTabId } from '@/src/modules/community-shell';

const TAB_IDS: readonly CommunityTabId[] = [
  'forum',
  'events',
  'missions',
  'services',
  'petitions',
];

const toCommunityTabId = (name: string): CommunityTabId =>
  TAB_IDS.find((id) => id === name) ?? 'forum';

function CommunityTabBar({ navigation, state }: BottomTabBarProps) {
  const activeTab = toCommunityTabId(state.routes[state.index].name);

  const handleTabPress = (id: CommunityTabId) => {
    const route = state.routes.find((item) => item.name === id);
    if (!route) {
      return;
    }
    const event = navigation.emit({
      canPreventDefault: true,
      target: route.key,
      type: 'tabPress',
    });
    if (!event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return <FloatingTabBar activeTab={activeTab} onTabPress={handleTabPress} />;
}

export default function CommunityTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Was hardcoded white -- every tab screen's safe-area strip (this
        // padding sits above each screen's own content) showed a white bar
        // at the top of the app on every device, standing out against the
        // rest of the app's desert-tan bg.canvas.
        sceneStyle: { backgroundColor: 'rgb(247,241,230)', paddingTop: insets.top },
      }}
      tabBar={(props) => <CommunityTabBar {...props} />}
    >
      <Tabs.Screen name="forum" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="missions" />
      <Tabs.Screen name="services" />
      <Tabs.Screen name="petitions" />
    </Tabs>
  );
}

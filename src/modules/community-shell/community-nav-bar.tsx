import { router } from 'expo-router';

import { FloatingTabBar, type CommunityTabId } from './floating-tab-bar';

// For screens that live outside the (tabs) navigator (Profile, Activity,
// Bookmarks) but should still show the persistent floating nav — none of
// the four tabs is "active" here, and pressing one navigates back into the
// already-mounted (tabs) stack rather than pushing a new screen.
export function CommunityNavBar() {
  return (
    <FloatingTabBar
      activeTab={null}
      onTabPress={(id: CommunityTabId) => router.navigate(`/(tabs)/${id}`)}
    />
  );
}

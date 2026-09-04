import { router, useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/src/modules/forum';

// Same screen as app/post/[id].tsx, reached only from Notifications (see
// resolve-notification-route.ts) -- registered separately in app/_layout.tsx
// with MODAL_SCREEN_OPTIONS so tapping a notification always opens a modal,
// without changing how this same screen presents from its many other entry
// points (forum list, search, activity, ...), which stay a plain push.
export default function NotificationPostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PostDetailScreen modal onBack={() => router.back()} postId={id} />;
}

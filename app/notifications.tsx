import { router } from 'expo-router';

import { NotificationsScreen } from '@/src/modules/notifications';

export default function NotificationsRoute() {
  return <NotificationsScreen onClose={() => router.back()} />;
}

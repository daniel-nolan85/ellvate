import { router, useLocalSearchParams } from 'expo-router';

import { EventDetailScreen } from '@/src/modules/events';

// See app/notification/post/[id].tsx for why this duplicates app/event/[id].tsx.
export default function NotificationEventDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <EventDetailScreen eventId={id} onBack={() => router.back()} />;
}

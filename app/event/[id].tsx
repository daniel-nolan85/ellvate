import { router, useLocalSearchParams } from 'expo-router';

import { EventDetailScreen } from '@/src/modules/events';

export default function EventDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <EventDetailScreen eventId={id} onBack={() => router.back()} />;
}

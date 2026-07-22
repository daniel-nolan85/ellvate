import { router, type Href } from 'expo-router';

import { EventsScreen } from '@/src/modules/events';

export default function EventsTab() {
  return (
    <EventsScreen
      onOpenEvent={(id) => router.push(`/event/${id}` as Href)}
    />
  );
}

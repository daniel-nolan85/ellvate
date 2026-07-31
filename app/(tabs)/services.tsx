import { router, type Href } from 'expo-router';

import { ServicesScreen } from '@/src/modules/services';

export default function ServicesTab() {
  return (
    <ServicesScreen
      onOpenListing={(id) => router.push(`/service/${id}` as Href)}
    />
  );
}

import { router, useLocalSearchParams } from 'expo-router';

import { ServiceDetailScreen } from '@/src/modules/services';

export default function ServiceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ServiceDetailScreen listingId={id} onBack={() => router.back()} />;
}

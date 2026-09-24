import { router, useLocalSearchParams } from 'expo-router';

import { BusinessDetailScreen } from '@/src/modules/businesses';

export default function BusinessDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <BusinessDetailScreen listingId={id} onBack={() => router.back()} />;
}

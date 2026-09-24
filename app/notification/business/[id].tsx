import { router, useLocalSearchParams } from 'expo-router';

import { BusinessDetailScreen } from '@/src/modules/businesses';

// See app/notification/post/[id].tsx for why this duplicates app/business/[id].tsx.
export default function NotificationBusinessDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <BusinessDetailScreen listingId={id} modal onBack={() => router.back()} />;
}

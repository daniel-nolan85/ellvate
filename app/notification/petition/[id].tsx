import { router, useLocalSearchParams } from 'expo-router';

import { PetitionDetailScreen } from '@/src/modules/petitions';

// See app/notification/post/[id].tsx for why this duplicates app/petition/[id].tsx.
export default function NotificationPetitionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PetitionDetailScreen onBack={() => router.back()} petitionId={id} />;
}

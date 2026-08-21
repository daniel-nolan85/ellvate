import { router, useLocalSearchParams } from 'expo-router';

import { PetitionDetailScreen } from '@/src/modules/petitions';

export default function PetitionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PetitionDetailScreen onBack={() => router.back()} petitionId={id} />;
}

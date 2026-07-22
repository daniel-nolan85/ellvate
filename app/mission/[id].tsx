import { router, useLocalSearchParams } from 'expo-router';

import { MissionDetailScreen } from '@/src/modules/missions';

export default function MissionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <MissionDetailScreen missionId={id} onBack={() => router.back()} />;
}

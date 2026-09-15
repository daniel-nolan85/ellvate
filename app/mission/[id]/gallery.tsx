import { router, useLocalSearchParams } from 'expo-router';

import { MissionCheckInGalleryScreen } from '@/src/modules/missions';

export default function MissionCheckInGalleryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <MissionCheckInGalleryScreen missionId={id} onBack={() => router.back()} />
  );
}

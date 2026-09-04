import { router, useLocalSearchParams } from 'expo-router';

import { MissionDetailScreen } from '@/src/modules/missions';

// See app/notification/post/[id].tsx for why this duplicates app/mission/[id].tsx.
export default function NotificationMissionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <MissionDetailScreen missionId={id} modal onBack={() => router.back()} />;
}

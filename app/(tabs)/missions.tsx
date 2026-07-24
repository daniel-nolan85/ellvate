import { router, type Href } from 'expo-router';

import { MissionsScreen } from '@/src/modules/missions';

export default function MissionsTab() {
  return (
    <MissionsScreen
      onOpenMission={(id) => router.push(`/mission/${id}` as Href)}
    />
  );
}

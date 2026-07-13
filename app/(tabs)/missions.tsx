import { router } from 'expo-router';

import { MissionsScreen } from '@/src/modules/missions';

export default function MissionsTab() {
  return (
    <MissionsScreen
      onOpenLeaderboard={() => router.navigate('/(tabs)/leaderboard')}
    />
  );
}

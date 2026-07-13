import { router } from 'expo-router';

import { LeaderboardScreen } from '@/src/modules/leaderboard';

export default function LeaderboardTab() {
  return (
    <LeaderboardScreen
      onBackToMissions={() => router.navigate('/(tabs)/missions')}
    />
  );
}

import { router } from 'expo-router';

import { ActivityScreen } from '@/src/modules/activity';

export default function ActivityRoute() {
  return <ActivityScreen onClose={() => router.back()} />;
}

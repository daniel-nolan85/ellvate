import { router } from 'expo-router';

import { AssistantScreen } from '@/src/modules/assistant';

export default function AssistantRoute() {
  return <AssistantScreen onClose={() => router.back()} />;
}

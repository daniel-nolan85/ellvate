import { useLocalSearchParams } from 'expo-router';

import { DigestScreen } from '@/src/modules/digest';

export default function DigestRoute() {
  const { weekStart } = useLocalSearchParams<{ weekStart?: string }>();

  return <DigestScreen weekStart={weekStart} />;
}

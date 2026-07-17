import { router, useLocalSearchParams } from 'expo-router';

import { MemberProfileScreen } from '@/src/modules/profile';

export default function MemberProfileRoute() {
  const { name, userId } = useLocalSearchParams<{
    userId: string;
    name?: string;
  }>();

  return (
    <MemberProfileScreen
      loadingName={name}
      onClose={() => router.back()}
      userId={userId}
    />
  );
}

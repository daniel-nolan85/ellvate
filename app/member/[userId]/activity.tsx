import { router, useLocalSearchParams } from 'expo-router';

import { MemberActivityScreen } from '@/src/modules/activity';

export default function MemberActivityRoute() {
  const { filter, name, userId } = useLocalSearchParams<{
    userId: string;
    name?: string;
    filter?: string;
  }>();

  return (
    <MemberActivityScreen
      filter={filter}
      loadingName={name}
      onClose={() => router.back()}
      userId={userId}
    />
  );
}

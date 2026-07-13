import { router, useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/src/modules/forum';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PostDetailScreen onBack={() => router.back()} postId={id} />;
}

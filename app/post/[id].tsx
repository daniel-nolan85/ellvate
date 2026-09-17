import { router, useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/src/modules/forum';

export default function PostDetailRoute() {
  const { focusComments, id } = useLocalSearchParams<{
    id: string;
    focusComments?: string;
  }>();

  return (
    <PostDetailScreen
      focusComments={focusComments === '1'}
      onBack={() => router.back()}
      postId={id}
    />
  );
}

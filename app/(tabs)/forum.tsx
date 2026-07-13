import { router, type Href } from 'expo-router';

import { ForumScreen } from '@/src/modules/forum';

export default function ForumTab() {
  return (
    <ForumScreen onOpenPost={(id) => router.push(`/post/${id}` as Href)} />
  );
}

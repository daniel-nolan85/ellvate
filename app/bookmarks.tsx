import { router } from 'expo-router';

import { BookmarksScreen } from '@/src/modules/bookmarks';

export default function BookmarksRoute() {
  return <BookmarksScreen onClose={() => router.back()} />;
}

import { router, type Href } from 'expo-router';

import { ForumScreen } from '@/src/modules/forum';

export default function ForumTab() {
  return (
    <ForumScreen
      onOpenPost={(id, focusComments) =>
        router.push(
          `/post/${id}${focusComments ? '?focusComments=1' : ''}` as Href,
        )
      }
    />
  );
}

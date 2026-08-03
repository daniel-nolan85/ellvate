import { router } from 'expo-router';

import { useSession } from '@/src/platform/session';

// Every screen that renders a member's name or avatar (posts, comments,
// events, missions, service listings/reviews) links to their profile the
// same way: your own content routes to your own profile screen, everyone
// else's routes to the read-only member profile.
export function useOpenProfile() {
  const session = useSession();
  const currentUserId = session.userId ?? 'demo-user';

  return (userId: string, name: string) => {
    if (userId === currentUserId) {
      router.push('/profile');
      return;
    }
    router.push({
      params: { name, userId },
      pathname: '/member/[userId]',
    });
  };
}

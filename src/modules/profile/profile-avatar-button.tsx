import { Pressable } from 'react-native';

import { router } from 'expo-router';

import { Avatar } from '@/src/components/ui/avatar';
import { useSession } from '@/src/platform/session';

import { useProfile } from './use-profile';

// The consistent entry point to the profile screen: a tappable avatar shown at
// the start of every screen title, mirroring how modern social apps place it.
export function ProfileAvatarButton() {
  const session = useSession();
  const profile = useProfile();
  // WHY: no name fallback for a signed-in user whose profile hasn't loaded
  // yet -- a placeholder like 'You' produces a real-looking (but wrong)
  // initial ('Y'), which briefly misrepresents the person's actual
  // initials. Leaving name undefined here lets Avatar fall back to its own
  // generic '?' instead.
  const name =
    profile.data?.profile.name ??
    (session.status === 'signed-in' ? undefined : 'Demo member');

  return (
    <Pressable
      accessibilityLabel="Open your profile"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.push('/profile')}
    >
      <Avatar
        className="rounded-full border-[1.5px] border-accent"
        name={name}
        size="sm"
        src={profile.data?.profile.avatarUrl ?? undefined}
      />
    </Pressable>
  );
}

import { Pressable } from 'react-native';

import { useUser } from '@clerk/expo';
import { router } from 'expo-router';

import { Avatar } from '@/src/components/ui/avatar';

// The consistent entry point to the profile screen: a tappable avatar shown at
// the start of every screen title, mirroring how modern social apps place it.
export function ProfileAvatarButton() {
  const { user } = useUser();
  const name =
    user?.firstName?.trim() || user?.fullName?.trim() || 'You';

  return (
    <Pressable
      accessibilityLabel="Open your profile"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.push('/profile')}
    >
      <Avatar name={name} size="sm" src={user?.imageUrl} />
    </Pressable>
  );
}

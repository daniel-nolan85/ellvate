import { router } from 'expo-router';

import { ProfileScreen } from '@/src/modules/profile';

export default function ProfileRoute() {
  return <ProfileScreen onClose={() => router.back()} />;
}
